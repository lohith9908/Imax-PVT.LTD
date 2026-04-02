# Phase -1: Local Development Setup

## 🎯 Objective
Enable any developer to clone the repository and start building within minutes without confusion or errors.

## ✅ Checklist

### 1. Repository Setup
- `git clone <repo>`
- Verify `.git` folder exists

### 2. Project Structure
```
imax/
├── backend/
│   ├── src/
│   │   ├── server.js         (Express app)
│   │   ├── models/           (MongoDB schemas)
│   │   ├── routes/           (API routes)
│   │   ├── controllers/       (Business logic)
│   │   ├── middleware/        (Auth, validation, etc.)
│   │   └── utils/            (Helpers)
│   ├── seeds/                (Database seeding)
│   ├── .env                  (Configuration - gitignored)
│   ├── .env.example          (Template for developers)
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── index.js          (Entry point)
│   │   ├── App.js            (Root component)
│   │   ├── components/       (Reusable UI components)
│   │   ├── pages/            (Page components)
│   │   └── services/         (API client)
│   ├── public/               (Static assets)
│   ├── .env                  (Configuration - gitignored)
│   ├── .env.example          (Template for developers)
│   └── package.json
│
└── package.json              (Root scripts)
```

### 3. Environment Configuration
**Backend (.env or .env.local)**
```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/imax_fertilizer
JWT_SECRET=supersecret123456
NODE_ENV=development
```

**Frontend (.env or .env.local)**
```
REACT_APP_API_URL=http://localhost:5000/api
```

### 4. Dependencies Installation
```bash
npm run install-all  # Installs roots, backend, frontend
```

### 5. Database Setup
Ensure MongoDB is running locally:
```bash
# For Windows with MongoDB installed:
mongod
```

### 6. Development Scripts
```bash
npm run dev          # Start both backend and frontend concurrently
npm run server       # Backend only
npm run client       # Frontend only

# Backend specific:
npm run seed         # Populate database with initial data
npm run lint         # Check code style
npm run lint:fix     # Auto-fix linting issues
```

### 7. Health Check
Backend: `http://localhost:5000/api/health`
Frontend: `http://localhost:3000`

### 8. Linting
- Backend: `.eslintrc.json` configured
- Frontend: `.eslintrc.json` configured (extends react-app)

### 9. Seed Data
```bash
npm run seed  # Populates initial data in MongoDB
```

### 10. Quick Start (Fresh Developer)
```bash
# 1. Clone and enter project
git clone <repo> && cd imax

# 2. Install all dependencies
npm run install-all

# 3. Start MongoDB (separate terminal)
mongod

# 4. Run development servers
npm run dev

# 5. Open browser
# Backend Health: http://localhost:5000/api/health
# Frontend: http://localhost:3000
```

## Verification

- ✓ Can run `npm run dev` without errors
- ✓ Backend responds at `/api/health`
- ✓ Frontend loads at `localhost:3000`
- ✓ MongoDB connection successful
- ✓ Linting passes (`npm run lint`)

## Troubleshooting

### "MongoDB connection error"
- Ensure MongoDB daemon is running: `mongod`
- Check `MONGO_URI` in `.env` is correct
- Check MongoDB is accessible on `localhost:27017`

### "Port 5000 already in use"
- Change `PORT` in `.env`
- Or kill existing process: `lsof -i :5000`

### "npm: command not found"
- Ensure Node.js is installed: `node --version`
- Reinstall Node.js from nodejs.org

### Linting errors on start
- Run `npm run lint:fix` to auto-correct
- Or fix manually according to `.eslintrc.json` rules
