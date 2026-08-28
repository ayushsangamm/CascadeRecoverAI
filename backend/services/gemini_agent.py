"""
Google Gemini AI Diagnostic Agent for CascadeRecover AI.
Analyzes failed payment transactions and recommends recovery actions.
Uses the new google-genai SDK (google.genai).
"""
import json
import os
import re
import logging
from dotenv import load_dotenv

# Load env from project root
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Soft decline error codes that can be retried
SOFT_DECLINE_CODES = {
    "NETWORK_TIMEOUT", "GATEWAY_504", "SERVER_ERROR",
    "TIMEOUT", "CONNECTION_RESET", "BANK_OFFLINE"
}


def _rule_based_diagnosis(error_code: str, error_description: str, attempts_count: int) -> dict:
    """Fallback rule-based diagnosis when Gemini is unavailable."""
    is_soft = error_code.upper() in SOFT_DECLINE_CODES

    if attempts_count >= 3:
        return {
            "decline_type": "HARD_DECLINE",
            "root_cause_summary": f"Maximum retry attempts reached after {attempts_count} tries. {error_description}",
            "recommended_action": "TERMINATE",
            "customer_message": "We were unable to process your payment after multiple attempts. Please contact your bank or try a different payment method.",
        }

    if is_soft:
        return {
            "decline_type": "SOFT_DECLINE",
            "root_cause_summary": f"Transient network/gateway failure detected: {error_description}. This is likely temporary and should resolve on retry.",
            "recommended_action": "SMART_RETRY",
            "customer_message": "We encountered a temporary network issue with your payment. We're automatically retrying — no action needed from your end!",
        }
    else:
        return {
            "decline_type": "HARD_DECLINE",
            "root_cause_summary": f"Hard decline from issuing bank: {error_description}. The card/account cannot be charged.",
            "recommended_action": "ALTERNATE_PAYMENT_LINK",
            "customer_message": "Your payment couldn't go through (card declined by bank). We've prepared a secure alternate payment link for you — it takes just 30 seconds!",
        }


async def diagnose_transaction(
    error_code: str,
    error_description: str,
    amount: float,
    customer_name: str,
    attempts_count: int,
) -> dict:
    """
    Use Google Gemini to diagnose a failed payment transaction.
    Returns structured JSON with decline_type, root_cause_summary,
    recommended_action, and customer_message.
    Falls back to rule-based if Gemini is unavailable.
    """
    if not GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set, using rule-based diagnosis")
        return _rule_based_diagnosis(error_code, error_description, attempts_count)

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

    # Try new google-genai SDK first
    try:
        from google import genai
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        raw = response.text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        result = json.loads(raw)
        required = ["decline_type", "root_cause_summary", "recommended_action", "customer_message"]
        if all(k in result for k in required):
            logger.info(f"Gemini (google-genai SDK) diagnosed: {result['recommended_action']}")
            return result
        logger.warning("Gemini returned incomplete JSON, using rule-based fallback")
        return _rule_based_diagnosis(error_code, error_description, attempts_count)

    except ImportError:
        pass  # Fall through to legacy SDK
    except json.JSONDecodeError as e:
        logger.error(f"Gemini JSON parse error (genai): {e}")
        return _rule_based_diagnosis(error_code, error_description, attempts_count)
    except Exception as e:
        logger.error(f"Gemini genai API error: {e}")
        # Fall through to legacy SDK

    # Fallback to legacy google-generativeai SDK
    try:
        import google.generativeai as genai_legacy
        genai_legacy.configure(api_key=GEMINI_API_KEY)
        model = genai_legacy.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        raw = response.text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        result = json.loads(raw)
        required = ["decline_type", "root_cause_summary", "recommended_action", "customer_message"]
        if all(k in result for k in required):
            logger.info(f"Gemini (legacy SDK) diagnosed: {result['recommended_action']}")
            return result
        return _rule_based_diagnosis(error_code, error_description, attempts_count)

    except json.JSONDecodeError as e:
        logger.error(f"Gemini JSON parse error (legacy): {e}")
        return _rule_based_diagnosis(error_code, error_description, attempts_count)
    except Exception as e:
        logger.error(f"Gemini legacy API error: {e}")
        return _rule_based_diagnosis(error_code, error_description, attempts_count)
