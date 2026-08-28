"""
Multi-channel notification service using Resend for CascadeRecover AI.
Sends recovery emails with dynamic payment links.
"""
import os
import logging
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FRONTEND_PORT = os.getenv("FRONTEND_PORT", "3000")
HOST = os.getenv("HOST", "127.0.0.1")


def _build_email_html(
    customer_name: str,
    amount: float,
    payment_link: str,
    customer_message: str,
    tx_id: str,
    error_code: str,
) -> str:
    """Build premium HTML email for payment recovery."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Complete Your Payment — CascadeRecover</title>
<style>
  body {{ margin:0; padding:0; background:#0B0F17; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }}
  .container {{ max-width:600px; margin:0 auto; padding:40px 20px; }}
  .card {{ background:#151D2A; border:1px solid #223046; border-radius:16px; padding:40px; }}
  .logo {{ color:#10B981; font-size:22px; font-weight:700; letter-spacing:-0.5px; margin-bottom:32px; }}
  .logo span {{ color:#6EE7B7; }}
  h1 {{ color:#F1F5F9; font-size:26px; font-weight:700; margin:0 0 12px; }}
  .subtitle {{ color:#94A3B8; font-size:15px; line-height:1.6; margin-bottom:28px; }}
  .amount-box {{ background:#0B1628; border:1px solid #1E3A5F; border-radius:12px; padding:20px 24px; margin-bottom:28px; }}
  .amount-label {{ color:#64748B; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px; }}
  .amount {{ color:#10B981; font-size:36px; font-weight:800; }}
  .tx-id {{ color:#475569; font-size:12px; margin-top:4px; }}
  .cta {{ display:block; background:linear-gradient(135deg, #10B981 0%, #059669 100%); color:#fff; text-decoration:none; text-align:center; padding:16px 32px; border-radius:10px; font-size:16px; font-weight:700; letter-spacing:0.3px; margin-bottom:20px; }}
  .cta:hover {{ background:linear-gradient(135deg, #059669 0%, #047857 100%); }}
  .note {{ color:#475569; font-size:13px; line-height:1.6; border-top:1px solid #1E293B; padding-top:20px; margin-top:8px; }}
  .badge {{ display:inline-block; background:#1E3A5F; color:#60A5FA; font-size:11px; font-weight:600; padding:3px 10px; border-radius:20px; margin-bottom:16px; }}
</style>
</head>
<body>
<div class="container">
  <div class="card">
    <div class="logo">Cascade<span>Recover</span> <span style="color:#475569;font-size:13px;font-weight:400;">AI</span></div>
    <div class="badge">⚡ Secure Payment Recovery</div>
    <h1>Hi {customer_name}, your payment needs attention</h1>
    <p class="subtitle">{customer_message}</p>
    <div class="amount-box">
      <div class="amount-label">Amount Due</div>
      <div class="amount">₹{amount:,.2f}</div>
      <div class="tx-id">Transaction Ref: {tx_id} &nbsp;·&nbsp; Error: {error_code}</div>
    </div>
    <a href="{payment_link}" class="cta">✅ Complete Payment Securely →</a>
    <div class="note">
      This link is valid for 24 hours and uses bank-grade 256-bit encryption.
      If you didn't initiate this transaction, please ignore this email.
      <br/><br/>
      Powered by <strong style="color:#10B981;">CascadeRecover AI</strong> · Razorpay Buildathon 2024
    </div>
  </div>
</div>
</body>
</html>"""


async def send_recovery_email(
    customer_name: str,
    customer_email: str,
    amount: float,
    tx_id: str,
    error_code: str,
    customer_message: str,
) -> bool:
    """
    Send a recovery email via Resend with a dynamic payment link.
    Returns True if successful, False otherwise.
    """
    payment_link = f"http://{HOST}:{FRONTEND_PORT}/pay/{tx_id}"

    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping email send")
        logger.info(f"[MOCK EMAIL] Would send to {customer_email}: {payment_link}")
        return True

    try:
        import resend
        resend.api_key = RESEND_API_KEY

        html_content = _build_email_html(
            customer_name=customer_name,
            amount=amount,
            payment_link=payment_link,
            customer_message=customer_message,
            tx_id=tx_id,
            error_code=error_code,
        )

        # Resend requires a verified sender domain — use onboarding@resend.dev for testing
        send_to = customer_email if "@resend.dev" in customer_email else "onboarding@resend.dev"

        params = {
            "from": "CascadeRecover AI <onboarding@resend.dev>",
            "to": [send_to],
            "subject": f"⚡ Complete your ₹{amount:,.2f} payment — Secure link inside",
            "html": html_content,
        }

        response = resend.Emails.send(params)
        logger.info(f"Resend email sent: {response}")
        return True

    except Exception as e:
        logger.error(f"Resend email error: {e}")
        return False
