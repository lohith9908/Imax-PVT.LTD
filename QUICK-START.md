# IMAX Project - Quick Start Commands

## 🚀 Start Everything (2 Terminals)

### Terminal 1: Backend
```bash
cd backend
npm run dev
```
✓ Runs on http://localhost:5000
✓ MongoDB connection required
✓ Socket.io listening

### Terminal 2: Frontend
```bash
cd frontend
npm run dev
```
✓ Runs on http://localhost:5173
✓ Auto-reload on code changes
✓ Real-time preview

---

## 📦 Installation (If Needed)

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd frontend
npm install
```

---

## 🧹 Maintenance

### Clear Frontend Cache
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Clear Backend Cache
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

### Linting Backend
```bash
cd backend
npm run lint
```

---

## 🔍 Database Seed (if needed)

**Backend includes seed data for testing:**
- Demo farmers (farmer@test.com)
- Demo owners (owner@test.com)
- Demo products
- Demo negotiations

---

## 🌐 URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/api/health
- **WebSocket**: ws://localhost:5000

---

## 📝 Demo Credentials

**Farmer Login**:
- Email: farmer@test.com
- Password: password123

**Owner Login**:
- Email: owner@test.com
- Password: password123

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Port 5173 in use | Change port in `vite.config.js` |
| Port 5000 in use | Change PORT in backend `.env` |
| Cannot connect to DB | Ensure MongoDB running locally |
| Socket not connecting | Check backend running + .env correct |
| CORS error | Check backend CORS config |
| Token expired | Login again |

---

## 📁 Project Structure

```
Imax/
├── backend/           # Node.js + Express server
│   ├── src/
│   │   ├── models/    # MongoDB schemas
│   │   ├── routes/    # API endpoints
│   │   ├── controllers/
│   │   ├── middleware/
│   │   └── services/
│   └── package.json
│
├── frontend/          # React 18 + Vite
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── contexts/
│   │   ├── services/
│   │   └── App.jsx
│   └── package.json
│
├── PHASE-6.md         # Backend Phase 6 docs
├── FRONTEND-SETUP.md  # This file's template
└── README.md
```

---

## 🚀 Next Steps

1. **Start Backend**: `cd backend && npm run dev`
2. **Start Frontend**: `cd frontend && npm run dev`
3. **Open Browser**: http://localhost:5173
4. **Login**: Use demo credentials
5. **Start Chatting**: Select negotiation from list
6. **Build Features**: Follow PRD requirements

---

## ✨ Current Status

✅ Phase 6 Backend Complete (9/9 tasks)
✅ Frontend Setup Complete (Auth + Chat UI)
🔄 Ready for development!

---

**Happy Coding!** 🎉
