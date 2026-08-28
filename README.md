# CascadeRecover AI ⚡

> **Razorpay AI Buildathon 2024 · Track 3: AI Revenue Recovery**

An autonomous, production-grade AI Revenue Recovery system that detects failed payments, diagnoses root causes with Google Gemini, triggers smart retries or alternate payment links, and delivers real-time GMV recovery through an interactive dashboard.

---

## 🏗️ Architecture

```
[Failure Ingestion] → [FastAPI Engine] → [Gemini AI Diagnosis]
       ├── Soft Decline → [Smart Retry Engine] ──┐
       └── Hard Decline → [Payment Link Generator] ──┤
                                                    ↓
                                         [Resend Email Trigger]
                                                    ↓
                                    [Customer Mock Checkout Modal]
                                                    ↓
                          [payment.captured → SSE → Live GMV Update]
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python · FastAPI · SQLite |
| AI Engine | Google Gemini 1.5 Flash |
| Notifications | Resend Email API |
| Frontend | Next.js 16 · React 19 · Tailwind v4 |
| Charts | Recharts |
| Animations | Framer Motion |
| Real-time | Server-Sent Events (SSE) |

---

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate
# Activate (Linux/macOS)
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Backend will be available at: **http://127.0.0.1:8000**  
API Docs: **http://127.0.0.1:8000/docs**

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will be available at: **http://localhost:3000**

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/simulate/fail` | Inject a single payment failure |
| `POST` | `/api/simulate/batch` | Inject 10 varied failures |
| `POST` | `/api/pay/mock-capture/{tx_id}` | Simulate payment capture |
| `GET` | `/api/transactions` | List all transactions |
| `GET` | `/api/metrics` | Get GMV recovery metrics |
| `GET` | `/api/events` | SSE stream for live updates |
| `DELETE` | `/api/reset` | Reset all data |

---

## 🎯 Features

- **AI Diagnosis**: Google Gemini 1.5 Flash classifies every failure as Soft or Hard decline
- **Smart Retry**: Transient failures are automatically retried with exponential backoff simulation
- **Alternate Payment Links**: Hard declines get instant fallback payment links
- **Resend Integration**: Premium HTML recovery emails sent via Resend API
- **Real-time SSE**: Live dashboard updates without polling
- **Mock Checkout**: Razorpay-styled payment modal for completing alternate payments
- **GMV Analytics**: Recharts visualization of at-risk vs. recovered revenue
- **Batch Simulation**: One-click injection of 10 diverse payment failure scenarios

---

## 🌍 Environment Variables

```env
GEMINI_API_KEY="your_gemini_api_key"
RESEND_API_KEY="your_resend_api_key"
HOST="127.0.0.1"
PORT=8000
FRONTEND_PORT=3000
```

---

## 📊 Recovery Flow

1. **Failure Detected** → Transaction ingested into pipeline
2. **AI Diagnosis** → Gemini analyzes error code and classifies
3. **Soft Decline** → Smart retry scheduled (5s delay simulation)
4. **Hard Decline** → Payment link generated immediately
5. **Email Sent** → Customer notified via Resend
6. **Checkout** → Customer completes payment at `/pay/{tx_id}`
7. **Captured** → SSE event updates dashboard, GMV counter increments

---

*Built with ❤️ for Razorpay AI Buildathon 2024*
