"""
Google Gemini AI Diagnostic Agent for CascadeRecover AI.
Analyzes failed payment transactions and recommends recovery actions.
Uses the new google-genai SDK (google.genai) with exponential-backoff
and instant rule-based fallback on 429 / timeout errors.
"""
import asyncio
import json
import os
import re
import logging
from dotenv import load_dotenv

# Load env from project root (two levels up from services/)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ── Deterministic classification maps & Heuristic Fallback ──────────────────
SOFT_DECLINE_CODES = {
    "NETWORK_TIMEOUT", "GATEWAY_504", "SERVER_ERROR",
    "TIMEOUT", "CONNECTION_RESET", "BANK_OFFLINE",
}

HARD_DECLINE_CODES = {
    "INSUFFICIENT_FUNDS", "CARD_EXPIRED", "AUTH_FAILED",
    "CARD_BLOCKED", "CVV_MISMATCH", "INVALID_PIN", "BAD_REQUEST_ERROR",
}

# Human-readable root-cause templates keyed by error code
_ROOT_CAUSE = {
    "NETWORK_TIMEOUT":    "Transient network timeout — gateway unreachable. Likely recoverable on retry.",
    "GATEWAY_504":        "Upstream bank server returned 504 during processing. Transient infrastructure issue.",
    "SERVER_ERROR":       "Internal server error in payment processor. Retry should succeed.",
    "TIMEOUT":            "Request timed out before bank acknowledgement. Safe to retry.",
    "CONNECTION_RESET":   "TCP connection reset mid-transaction. No charge was made — safe to retry.",
    "BANK_OFFLINE":       "Issuing bank reported offline status. Retry when bank comes back online.",
    "INSUFFICIENT_FUNDS": "Card declined — account balance insufficient to cover the transaction amount.",
    "CARD_EXPIRED":       "Card expiry date has passed. Customer must use an alternate payment method.",
    "AUTH_FAILED":        "3-D Secure / OTP authentication failed. Bank hard-declined the charge.",
    "CARD_BLOCKED":       "Card is blocked by the issuing bank. Customer must contact their bank.",
    "CVV_MISMATCH":       "CVV entered does not match card records. Hard decline — alternate payment needed.",
    "INVALID_PIN":        "Incorrect PIN entered. Bank has declined this transaction.",
    "BAD_REQUEST_ERROR":  "Malformed payment request rejected by processor. Alternate payment required.",
}

_CUSTOMER_MSG = {
    "SOFT_DECLINE": (
        "We hit a temporary network hiccup — don't worry, we're retrying automatically! "
        "If the issue persists, we'll send you a quick alternate payment link."
    ),
    "HARD_DECLINE": (
        "Your payment couldn't go through (card declined by bank). "
        "We've prepared a secure 1-click alternate payment link — it takes under 30 seconds!"
    ),
    "TERMINATE": (
        "We were unable to process your payment after multiple attempts. "
        "Please contact your bank or try a completely different payment method."
    ),
}

HEURISTIC_RULES = {
    "NETWORK_TIMEOUT": {
        "decision": "Transient network timeout — gateway unreachable. Likely recoverable on retry.",
        "action": "Smart Retry",
        "decline_type": "Soft decline",
    },
    "GATEWAY_504": {
        "decision": "Upstream bank server returned 504 during processing. Transient infrastructure issue.",
        "action": "Smart Retry",
        "decline_type": "Soft decline",
    },
    "CVV_MISMATCH": {
        "decision": "CVV entered does not match card records. Hard decline — alternate payment needed.",
        "action": "Alt. Link",
        "decline_type": "Hard decline",
    },
    "INSUFFICIENT_FUNDS": {
        "decision": "Card declined — account balance insufficient to cover the transaction amount.",
        "action": "Alt. Link",
        "decline_type": "Hard decline",
    },
    "CARD_BLOCKED": {
        "decision": "Card is blocked by the issuing bank. Customer must contact their bank.",
        "action": "Alt. Link",
        "decline_type": "Hard decline",
    },
    "CARD_EXPIRED": {
        "decision": "Card expiry date has passed. Customer must use an alternate payment method.",
        "action": "Alt. Link",
        "decline_type": "Hard decline",
    },
    "AUTH_FAILED": {
        "decision": "3-D Secure / OTP authentication failed. Bank hard-declined the charge.",
        "action": "Alt. Link",
        "decline_type": "Hard decline",
    },
}

DEFAULT_FALLBACK = {
    "decision": "Payment failure detected. Initiating automated recovery route.",
    "action": "Alt. Link",
    "decline_type": "Hard decline",
}


def _heuristic_fallback(error_code: str, error_description: str, attempts_count: int) -> dict:
    """
    Deterministic heuristic fallback.
    Conforms to standard recovery fields matching the frontend schema.
    """
    code = error_code.upper()

    if attempts_count >= 3:
        decision = f"Max retry cap ({attempts_count} attempts) reached. " + HEURISTIC_RULES.get(code, {}).get("decision", error_description)
        action = "Terminate"
        decline_type = "Hard decline"
    else:
        rule = HEURISTIC_RULES.get(code, DEFAULT_FALLBACK)
        decision = rule["decision"]
        action = rule["action"]
        decline_type = rule["decline_type"]

    if action == "Smart Retry":
        cust_msg = _CUSTOMER_MSG["SOFT_DECLINE"]
    elif action == "Terminate":
        cust_msg = _CUSTOMER_MSG["TERMINATE"]
    else:
        cust_msg = _CUSTOMER_MSG["HARD_DECLINE"]

    return {
        "decision": decision,
        "action": action,
        "decline_type": decline_type,
        "customer_message": cust_msg,
        # Legacy mappings for backward compatibility
        "root_cause_summary": decision,
        "recommended_action": "SMART_RETRY" if action == "Smart Retry" else ("TERMINATE" if action == "Terminate" else "ALTERNATE_PAYMENT_LINK"),
    }


def _rule_based_diagnosis(error_code: str, error_description: str, attempts_count: int) -> dict:
    """Legacy alias calling the new heuristic fallback."""
    return _heuristic_fallback(error_code, error_description, attempts_count)


def _is_rate_limit_error(exc: Exception) -> bool:
    """Detect 429 / quota-exhausted / resource-exhausted errors from any SDK."""
    msg = str(exc).lower()
    return any(k in msg for k in (
        "429", "rate", "quota", "resource_exhausted",
        "resource exhausted", "too many", "limit exceeded",
    ))


async def _call_gemini_genai(prompt: str, timeout: float = 8.0) -> dict | None:
    """
    Call the new google-genai SDK (gemini-2.0-flash) with a hard timeout.
    Returns parsed dict or None on any error.
    """
    try:
        from google import genai  # type: ignore

        def _sync_call():
            client = genai.Client(api_key=GEMINI_API_KEY)
            return client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
            )

        loop = asyncio.get_event_loop()
        response = await asyncio.wait_for(
            loop.run_in_executor(None, _sync_call),
            timeout=timeout,
        )

        raw = response.text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        result = json.loads(raw)

        # Allow mapping either schema format from LLM
        if "decision" in result and "action" in result and "decline_type" in result:
            return result

        required = {"decline_type", "root_cause_summary", "recommended_action", "customer_message"}
        if required.issubset(result.keys()):
            return result
        logger.warning("Gemini (genai) returned incomplete JSON")
        return None

    except asyncio.TimeoutError:
        logger.warning("Gemini (genai) timed out — using fallback")
        return None
    except ImportError:
        return None  # SDK not installed
    except json.JSONDecodeError as e:
        logger.error(f"Gemini (genai) JSON parse error: {e}")
        return None
    except Exception as e:
        if _is_rate_limit_error(e):
            logger.warning(f"Gemini (genai) rate-limited (429) — falling back immediately")
        else:
            logger.error(f"Gemini (genai) API error: {e}")
        return None


async def _call_gemini_legacy(prompt: str, timeout: float = 8.0) -> dict | None:
    """
    Call the legacy google-generativeai SDK (gemini-1.5-flash) with a hard timeout.
    Returns parsed dict or None on any error.
    """
    try:
        import google.generativeai as genai_legacy  # type: ignore

        def _sync_call():
            genai_legacy.configure(api_key=GEMINI_API_KEY)
            model = genai_legacy.GenerativeModel("gemini-1.5-flash")
            return model.generate_content(prompt)

        loop = asyncio.get_event_loop()
        response = await asyncio.wait_for(
            loop.run_in_executor(None, _sync_call),
            timeout=timeout,
        )

        raw = response.text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        result = json.loads(raw)

        if "decision" in result and "action" in result and "decline_type" in result:
            return result

        required = {"decline_type", "root_cause_summary", "recommended_action", "customer_message"}
        if required.issubset(result.keys()):
            return result
        return None

    except asyncio.TimeoutError:
        logger.warning("Gemini (legacy) timed out — using fallback")
        return None
    except ImportError:
        return None
    except json.JSONDecodeError as e:
        logger.error(f"Gemini (legacy) JSON parse error: {e}")
        return None
    except Exception as e:
        if _is_rate_limit_error(e):
            logger.warning("Gemini (legacy) rate-limited (429) — falling back immediately")
        else:
            logger.error(f"Gemini (legacy) API error: {e}")
        return None


async def diagnose_transaction(
    error_code: str,
    error_description: str,
    amount: float,
    customer_name: str,
    attempts_count: int,
) -> dict:
    """
    Diagnose a failed payment transaction.

    Strategy:
      1. If no API key → instant rule-based result.
      2. Try google-genai SDK (gemini-2.0-flash) with 8s timeout.
      3. On 429 / timeout / error → immediately try legacy SDK.
      4. If both fail → instant rule-based result (zero delay).
    """
    if not GEMINI_API_KEY:
        logger.info("No GEMINI_API_KEY — using heuristic fallback")
        return _heuristic_fallback(error_code, error_description, attempts_count)

    prompt = f"""You are an expert payment failure recovery AI for a fintech platform.

Analyze this failed payment transaction and return ONLY a JSON object (no markdown, no extra text):

Transaction Details:
- Error Code: {error_code}
- Error Description: {error_description}
- Amount: ₹{amount}
- Customer: {customer_name}
- Previous Attempts: {attempts_count}

Soft declines (transient, retryable): NETWORK_TIMEOUT, GATEWAY_504, SERVER_ERROR, TIMEOUT, CONNECTION_RESET, BANK_OFFLINE
Hard declines (permanent, need alternate): INSUFFICIENT_FUNDS, CARD_EXPIRED, AUTH_FAILED, CARD_BLOCKED, CVV_MISMATCH, BAD_REQUEST_ERROR

Rules:
- If attempts_count >= 3: recommended_action must be "TERMINATE"
- If soft decline: recommended_action should be "SMART_RETRY"
- If hard decline: recommended_action should be "ALTERNATE_PAYMENT_LINK"

Return JSON with exactly these fields:
{{
  "decline_type": "SOFT_DECLINE" | "HARD_DECLINE",
  "root_cause_summary": "concise technical explanation (1-2 sentences)",
  "recommended_action": "SMART_RETRY" | "ALTERNATE_PAYMENT_LINK" | "TERMINATE",
  "customer_message": "friendly, high-converting recovery message for the customer (max 2 sentences)"
}}"""

    # Attempt 1 — new google-genai SDK
    try:
        result = await _call_gemini_genai(prompt, timeout=8.0)
        if result:
            logger.info(f"Gemini (genai) → {result.get('recommended_action', result.get('action', ''))} for {error_code}")
            return result
    except Exception as e:
        logger.error(f"Gemini (genai) call crashed: {e}", exc_info=True)

    # Attempt 2 — legacy google-generativeai SDK
    try:
        result = await _call_gemini_legacy(prompt, timeout=8.0)
        if result:
            logger.info(f"Gemini (legacy) → {result.get('recommended_action', result.get('action', ''))} for {error_code}")
            return result
    except Exception as e:
        logger.error(f"Gemini (legacy) call crashed: {e}", exc_info=True)

    # Instant heuristic fallback
    logger.info(f"Fallback executed for {error_code}")
    return _heuristic_fallback(error_code, error_description, attempts_count)

