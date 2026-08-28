"""
Simulator router — core business logic for CascadeRecover AI.
Handles failure ingestion, AI diagnosis, retry scheduling,
payment capture, metrics, and SSE streaming.
"""
import asyncio
import json
import logging
import os
import random
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from database import get_db, broadcast_sse_event, sse_event_queues
from models import Transaction, AuditLog, TransactionStatus
from services.gemini_agent import diagnose_transaction
from services.notifier import send_recovery_email

logger = logging.getLogger(__name__)

FRONTEND_PORT = os.getenv("FRONTEND_PORT", "3000")
HOST = os.getenv("HOST", "127.0.0.1")

router = APIRouter()

# ─────────────────────────────────────────────────
# Request / Response Schemas
# ─────────────────────────────────────────────────

class FailPayload(BaseModel):
    amount: float
    currency: str = "INR"
    customer_name: str
    customer_email: str
    customer_phone: str = ""
    error_code: str
    error_description: str


class TransactionOut(BaseModel):
    id: str
    amount: float
    currency: str
    customer_name: str
    customer_email: str
    customer_phone: str | None
    error_code: str
    error_description: str
    status: str
    attempts_count: int
    decline_type: str | None
    ai_reasoning: str | None
    ai_action: str | None
    customer_message: str | None
    payment_link: str | None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────────
# Batch Test Data
# ─────────────────────────────────────────────────

BATCH_SCENARIOS = [
    {"amount": 499.0, "customer_name": "Arjun Sharma", "customer_email": "arjun@demo.com", "customer_phone": "9876543210", "error_code": "NETWORK_TIMEOUT", "error_description": "Request timed out after 30s — gateway unreachable"},
    {"amount": 1299.0, "customer_name": "Priya Nair", "customer_email": "priya@demo.com", "customer_phone": "9876543211", "error_code": "INSUFFICIENT_FUNDS", "error_description": "Account balance ₹0 — insufficient funds"},
    {"amount": 2999.0, "customer_name": "Rahul Gupta", "customer_email": "rahul@demo.com", "customer_phone": "9876543212", "error_code": "CARD_EXPIRED", "error_description": "Card expired 03/24 — renewal required"},
    {"amount": 5499.0, "customer_name": "Sneha Reddy", "customer_email": "sneha@demo.com", "customer_phone": "9876543213", "error_code": "GATEWAY_504", "error_description": "504 Bad Gateway — upstream bank server timeout"},
    {"amount": 799.0, "customer_name": "Vikram Patel", "customer_email": "vikram@demo.com", "customer_phone": "9876543214", "error_code": "AUTH_FAILED", "error_description": "3D Secure authentication failed — OTP mismatch"},
    {"amount": 8999.0, "customer_name": "Kavya Iyer", "customer_email": "kavya@demo.com", "customer_phone": "9876543215", "error_code": "NETWORK_TIMEOUT", "error_description": "DNS resolution failed — network connectivity issue"},
    {"amount": 3499.0, "customer_name": "Ankit Joshi", "customer_email": "ankit@demo.com", "customer_phone": "9876543216", "error_code": "CARD_BLOCKED", "error_description": "Card blocked by issuing bank due to suspicious activity"},
    {"amount": 12999.0, "customer_name": "Divya Menon", "customer_email": "divya@demo.com", "customer_phone": "9876543217", "error_code": "GATEWAY_504", "error_description": "Payment processor unavailable — maintenance window"},
    {"amount": 649.0, "customer_name": "Kiran Rao", "customer_email": "kiran@demo.com", "customer_phone": "9876543218", "error_code": "CVV_MISMATCH", "error_description": "CVV entered does not match card records"},
    {"amount": 14999.0, "customer_name": "Meera Singh", "customer_email": "meera@demo.com", "customer_phone": "9876543219", "error_code": "NETWORK_TIMEOUT", "error_description": "SSL handshake timeout — TLS negotiation failed"},
]


# ─────────────────────────────────────────────────
# Core Pipeline
# ─────────────────────────────────────────────────

async def run_recovery_pipeline(tx: Transaction, db: Session):
    """
    Autonomous AI recovery pipeline:
    1. Diagnose with Gemini
    2. Route to Smart Retry or Payment Link
    3. Send notification
    4. Broadcast SSE events
    """
    try:
        # Step 1: AI Diagnosis
        diagnosis = await diagnose_transaction(
            error_code=tx.error_code,
            error_description=tx.error_description,
            amount=tx.amount,
            customer_name=tx.customer_name,
            attempts_count=tx.attempts_count,
        )

        tx.decline_type = diagnosis.get("decline_type")
        tx.ai_reasoning = diagnosis.get("root_cause_summary")
        tx.ai_action = diagnosis.get("recommended_action")
        tx.customer_message = diagnosis.get("customer_message")
        tx.attempts_count += 1
        tx.updated_at = datetime.now(timezone.utc)

        log_ai = AuditLog(
            transaction_id=tx.id,
            step_name="AI_DIAGNOSIS",
            reasoning=diagnosis.get("root_cause_summary"),
            channel_action=f"Gemini → {diagnosis.get('recommended_action')}",
        )
        db.add(log_ai)
        db.commit()

        await broadcast_sse_event({
            "type": "AI_DIAGNOSIS",
            "tx_id": tx.id,
            "customer_name": tx.customer_name,
            "amount": tx.amount,
            "error_code": tx.error_code,
            "decline_type": tx.decline_type,
            "action": tx.ai_action,
            "reasoning": tx.ai_reasoning,
            "status": tx.status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        # Step 2: Route by action
        recommended = diagnosis.get("recommended_action")

        if recommended == "TERMINATE" or tx.attempts_count > 3:
            tx.status = TransactionStatus.PERMANENTLY_FAILED
            db.commit()
            log_term = AuditLog(
                transaction_id=tx.id,
                step_name="TERMINATED",
                reasoning="Max attempts reached or terminal error",
                channel_action="No further action",
            )
            db.add(log_term)
            db.commit()

            await broadcast_sse_event({
                "type": "STATUS_UPDATE",
                "tx_id": tx.id,
                "status": "PERMANENTLY_FAILED",
                "customer_name": tx.customer_name,
                "amount": tx.amount,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            return

        elif recommended == "SMART_RETRY":
            tx.status = TransactionStatus.RETRY_SCHEDULED
            db.commit()

            await broadcast_sse_event({
                "type": "RETRY_SCHEDULED",
                "tx_id": tx.id,
                "customer_name": tx.customer_name,
                "amount": tx.amount,
                "status": "RETRY_SCHEDULED",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

            # Simulated async delay retry (5 seconds)
            await asyncio.sleep(5)

            # After retry, escalate to payment link
            tx.status = TransactionStatus.LINK_SENT
            tx.payment_link = f"http://{HOST}:{FRONTEND_PORT}/pay/{tx.id}"
            db.commit()

            log_retry = AuditLog(
                transaction_id=tx.id,
                step_name="SMART_RETRY_EXECUTED",
                reasoning="Auto-retry after transient failure — escalating to payment link",
                channel_action="Email: Payment Link Sent",
            )
            db.add(log_retry)
            db.commit()

            email_sent = await send_recovery_email(
                customer_name=tx.customer_name,
                customer_email=tx.customer_email,
                amount=tx.amount,
                tx_id=tx.id,
                error_code=tx.error_code,
                customer_message=tx.customer_message or "",
            )

            await broadcast_sse_event({
                "type": "LINK_SENT",
                "tx_id": tx.id,
                "customer_name": tx.customer_name,
                "amount": tx.amount,
                "payment_link": tx.payment_link,
                "email_sent": email_sent,
                "status": "LINK_SENT",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

        elif recommended == "ALTERNATE_PAYMENT_LINK":
            tx.status = TransactionStatus.LINK_SENT
            tx.payment_link = f"http://{HOST}:{FRONTEND_PORT}/pay/{tx.id}"
            db.commit()

            log_link = AuditLog(
                transaction_id=tx.id,
                step_name="PAYMENT_LINK_GENERATED",
                reasoning="Hard decline — alternate payment link generated",
                channel_action="Email: Alternate Payment Link",
            )
            db.add(log_link)
            db.commit()

            email_sent = await send_recovery_email(
                customer_name=tx.customer_name,
                customer_email=tx.customer_email,
                amount=tx.amount,
                tx_id=tx.id,
                error_code=tx.error_code,
                customer_message=tx.customer_message or "",
            )

            await broadcast_sse_event({
                "type": "LINK_SENT",
                "tx_id": tx.id,
                "customer_name": tx.customer_name,
                "amount": tx.amount,
                "payment_link": tx.payment_link,
                "email_sent": email_sent,
                "status": "LINK_SENT",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

    except Exception as e:
        logger.error(f"Pipeline error for {tx.id}: {e}")
        db.rollback()


# ─────────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────────

@router.post("/simulate/fail")
async def simulate_fail(payload: FailPayload, db: Session = Depends(get_db)):
    """Ingest a single simulated payment failure."""
    tx_id = str(uuid.uuid4())[:8].upper()
    tx = Transaction(
        id=tx_id,
        amount=payload.amount,
        currency=payload.currency,
        customer_name=payload.customer_name,
        customer_email=payload.customer_email,
        customer_phone=payload.customer_phone,
        error_code=payload.error_code,
        error_description=payload.error_description,
        status=TransactionStatus.FAILED,
        attempts_count=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)

    # Log initial failure
    log = AuditLog(
        transaction_id=tx.id,
        step_name="FAILURE_INGESTED",
        reasoning=f"Payment failed: {payload.error_code}",
        channel_action="Pipeline initiated",
    )
    db.add(log)
    db.commit()

    # Broadcast failure event
    await broadcast_sse_event({
        "type": "FAILURE_INGESTED",
        "tx_id": tx.id,
        "customer_name": tx.customer_name,
        "amount": tx.amount,
        "error_code": tx.error_code,
        "status": "FAILED",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    # Run pipeline in background
    asyncio.create_task(run_recovery_pipeline(tx, db))

    return {"status": "pipeline_started", "tx_id": tx.id, "message": f"Recovery pipeline initiated for ₹{payload.amount}"}


@router.post("/simulate/batch")
async def simulate_batch(db: Session = Depends(get_db)):
    """Inject 10 varied failure scenarios for batch testing."""
    results = []
    for scenario in BATCH_SCENARIOS:
        tx_id = str(uuid.uuid4())[:8].upper()
        tx = Transaction(
            id=tx_id,
            amount=scenario["amount"],
            currency="INR",
            customer_name=scenario["customer_name"],
            customer_email=scenario["customer_email"],
            customer_phone=scenario["customer_phone"],
            error_code=scenario["error_code"],
            error_description=scenario["error_description"],
            status=TransactionStatus.FAILED,
            attempts_count=0,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(tx)
        db.commit()
        db.refresh(tx)

        log = AuditLog(
            transaction_id=tx.id,
            step_name="FAILURE_INGESTED",
            reasoning=f"Batch ingestion: {scenario['error_code']}",
            channel_action="Batch pipeline initiated",
        )
        db.add(log)
        db.commit()

        await broadcast_sse_event({
            "type": "FAILURE_INGESTED",
            "tx_id": tx.id,
            "customer_name": tx.customer_name,
            "amount": tx.amount,
            "error_code": tx.error_code,
            "status": "FAILED",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        # Stagger pipeline starts
        asyncio.create_task(_staggered_pipeline(tx, db, delay=BATCH_SCENARIOS.index(scenario) * 0.5))
        results.append({"tx_id": tx.id, "amount": tx.amount, "error": tx.error_code})

    return {"status": "batch_started", "count": len(results), "transactions": results}


async def _staggered_pipeline(tx: Transaction, db: Session, delay: float):
    await asyncio.sleep(delay)
    await run_recovery_pipeline(tx, db)


@router.post("/pay/mock-capture/{tx_id}")
async def mock_capture(tx_id: str, db: Session = Depends(get_db)):
    """Simulate customer completing payment via alternate rail."""
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if tx.status == TransactionStatus.RECOVERED:
        return {"status": "already_recovered", "tx_id": tx_id}

    tx.status = TransactionStatus.RECOVERED
    tx.updated_at = datetime.now(timezone.utc)
    db.commit()

    log = AuditLog(
        transaction_id=tx.id,
        step_name="PAYMENT_CAPTURED",
        reasoning="Customer completed payment via alternate checkout modal",
        channel_action="Mock Gateway: payment.captured",
    )
    db.add(log)
    db.commit()

    await broadcast_sse_event({
        "type": "PAYMENT_CAPTURED",
        "tx_id": tx.id,
        "customer_name": tx.customer_name,
        "amount": tx.amount,
        "status": "RECOVERED",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "status": "recovered",
        "tx_id": tx_id,
        "amount": tx.amount,
        "customer_name": tx.customer_name,
        "message": f"Payment of ₹{tx.amount:,.2f} successfully captured!",
    }


@router.get("/transactions")
async def get_transactions(db: Session = Depends(get_db)):
    """Return all transactions with their current state."""
    txns = db.query(Transaction).order_by(Transaction.created_at.desc()).all()
    return [
        {
            "id": t.id,
            "amount": t.amount,
            "currency": t.currency,
            "customer_name": t.customer_name,
            "customer_email": t.customer_email,
            "customer_phone": t.customer_phone,
            "error_code": t.error_code,
            "error_description": t.error_description,
            "status": t.status,
            "attempts_count": t.attempts_count,
            "decline_type": t.decline_type,
            "ai_reasoning": t.ai_reasoning,
            "ai_action": t.ai_action,
            "customer_message": t.customer_message,
            "payment_link": t.payment_link,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        }
        for t in txns
    ]


@router.get("/metrics")
async def get_metrics(db: Session = Depends(get_db)):
    """Return aggregated GMV recovery metrics."""
    all_txns = db.query(Transaction).all()

    total_at_risk = sum(t.amount for t in all_txns if t.status not in [TransactionStatus.RECOVERED])
    recovered_gmv = sum(t.amount for t in all_txns if t.status == TransactionStatus.RECOVERED)
    total_gmv = sum(t.amount for t in all_txns)
    active_cases = sum(1 for t in all_txns if t.status in [TransactionStatus.FAILED, TransactionStatus.RETRY_SCHEDULED, TransactionStatus.LINK_SENT])
    recovery_rate = (recovered_gmv / total_gmv * 100) if total_gmv > 0 else 0

    return {
        "total_at_risk_gmv": round(total_at_risk, 2),
        "recovered_gmv": round(recovered_gmv, 2),
        "total_gmv": round(total_gmv, 2),
        "recovery_rate_pct": round(recovery_rate, 1),
        "active_cases": active_cases,
        "total_transactions": len(all_txns),
        "permanently_failed": sum(1 for t in all_txns if t.status == TransactionStatus.PERMANENTLY_FAILED),
        "link_sent": sum(1 for t in all_txns if t.status == TransactionStatus.LINK_SENT),
        "retry_scheduled": sum(1 for t in all_txns if t.status == TransactionStatus.RETRY_SCHEDULED),
    }


@router.get("/transaction/{tx_id}")
async def get_transaction(tx_id: str, db: Session = Depends(get_db)):
    """Get a single transaction by ID."""
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {
        "id": tx.id,
        "amount": tx.amount,
        "currency": tx.currency,
        "customer_name": tx.customer_name,
        "customer_email": tx.customer_email,
        "error_code": tx.error_code,
        "error_description": tx.error_description,
        "status": tx.status,
        "decline_type": tx.decline_type,
        "ai_reasoning": tx.ai_reasoning,
        "customer_message": tx.customer_message,
        "payment_link": tx.payment_link,
    }


@router.get("/events")
async def sse_stream():
    """Server-Sent Events stream for real-time dashboard updates."""
    async def event_generator() -> AsyncGenerator[str, None]:
        q: asyncio.Queue = asyncio.Queue()
        sse_event_queues.append(q)
        try:
            # Send initial heartbeat
            yield f"data: {json.dumps({'type': 'CONNECTED', 'message': 'CascadeRecover AI stream connected'})}\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=20.0)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat
                    yield f"data: {json.dumps({'type': 'HEARTBEAT', 'timestamp': datetime.now(timezone.utc).isoformat()})}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            if q in sse_event_queues:
                sse_event_queues.remove(q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.delete("/reset")
async def reset_system(db: Session = Depends(get_db)):
    """Reset the system — clear all transactions and audit logs."""
    db.query(AuditLog).delete()
    db.query(Transaction).delete()
    db.commit()

    await broadcast_sse_event({
        "type": "SYSTEM_RESET",
        "message": "System reset — all data cleared",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return {"status": "reset", "message": "System reset successfully"}
