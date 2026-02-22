# ExorVia Quick Reference Card

Print this and keep it handy while setting up!

---

## ⚡ QUICK START (5 Steps)

### Step 1: Create Database
```bash
python << 'EOF'
import sqlite3
conn = sqlite3.connect('backend/exorvia.db')
c = conn.cursor()
c.execute('''CREATE TABLE orders (
    date TEXT, product TEXT, amount INTEGER)''')
c.execute("INSERT INTO orders VALUES ('2024-01-01', 'Laptop', 1000)")
conn.commit()
EOF
```

### Step 2: Backend (.env file)
```
OPENAI_API_KEY=sk-your-key-here
DB_URI=sqlite:///./exorvia.db
FLASK_PORT=5000
FLASK_ENV=development
```

### Step 3: Backend Start
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

### Step 4: Frontend Start (New Terminal)
```bash
cd frontend
npx create-react-app .
npm install lucide-react
npm start
```

### Step 5: Test It
1. Open http://localhost:3000
2. Click "Text Analysis"
3. Type: "What are my top products?"
4. Hit Send
5. See results! ✅

---

## 🔍 PORTS & URLS

```
Frontend:  http://localhost:3000   (React website)
Backend:   http://localhost:5000   (Python server)

API Endpoints:
  POST /api/text/analyze      → Analyze text
  POST /api/graphs/generate   → Create charts
  GET /api/health             → Check if running
```

---

## 📁 FILE LOCATIONS

```
Backend:
  app.py             → Main logic
  .env               → Secrets (EDIT THIS!)
  requirements.txt   → Python packages
  exorvia.db         → Database

Frontend:
  src/App.jsx        → Main component
  src/api.js         → Talks to Python
  src/index.js       → Starter
  src/index.css      → Styles
  package.json       → JS packages
  .env               → Config
```

---

## 🔗 HOW IT WORKS

```
User Types Question
        ↓
Browser sends to Python
        ↓
Python calls OpenAI: "Make SQL"
        ↓
Python runs SQL on database
        ↓
Python calls OpenAI: "Summarize"
        ↓
Browser displays results
```

---

## 🐛 QUICK FIXES

| Error | Fix |
|-------|-----|
| "Can't connect" | Is backend running? Port 5000? |
| "Blank page" | Check F12 console for errors |
| "Database error" | Run create database script above |
| "No API key" | Get key from openai.com, add to .env |
| "Port in use" | Kill process or use different port |

---

## ✅ VERIFICATION

```bash
# Is backend running?
curl http://localhost:5000/api/health

# Is frontend running?
# Open http://localhost:3000 in browser

# Does database exist?
sqlite3 backend/exorvia.db "SELECT COUNT(*) FROM orders"
```

---

## 📋 CHECKLIST

- [ ] Python installed (python --version)
- [ ] Node.js installed (node --version)
- [ ] OpenAI API key obtained
- [ ] Database created
- [ ] .env file filled
- [ ] Backend running
- [ ] Frontend running
- [ ] Test question working

---

## 🎯 THE 3 PIECES

| Part | Where | What |
|------|-------|------|
| Frontend | Port 3000 | Website (React) |
| Backend | Port 5000 | Brain (Python) |
| Database | Disk | Data (SQLite) |

---

## 📞 COMMON QUESTIONS

**Q: What if I don't have OpenAI key?**
A: Get one free at https://platform.openai.com/api-keys

**Q: Can I use PostgreSQL?**
A: Yes! Set `DB_URI=postgresql://user:pass@host/db`

**Q: Do I need two terminals?**
A: Yes, one for backend, one for frontend

**Q: What if port 3000 is in use?**
A: React will ask to use 3000. Press 'y'

**Q: Where's my data stored?**
A: In exorvia.db (a file on your disk)

---

## 🚀 TO MAKE CHANGES

**Edit styling:**
- Edit src/index.css or src/styles.css
- Save and refresh browser

**Edit functionality:**
- Edit src/App.jsx or backend/app.py
- Save and refresh/restart

**Add database table:**
```bash
sqlite3 backend/exorvia.db
> CREATE TABLE customers (id INTEGER, name TEXT);
> INSERT INTO customers VALUES (1, 'John');
```

---

## 💡 WHAT HAPPENS WHEN YOU ASK A QUESTION

1. You type: "What are my top products?"
2. Browser sends it to Python
3. Python asks OpenAI: "Make 5-10 questions"
4. Python loops: For each question:
   - Ask OpenAI: "Make SQL"
   - Run SQL on database
   - Get results
5. Python asks OpenAI: "Summarize this"
6. Python sends back: summary + questions + results
7. Browser shows it on dashboard

**All in 5-10 seconds!**

---

## 🎨 CUSTOMIZE COLORS

In `src/index.css` or `src/App.jsx` styles:

```css
/* Dark blue (main) */
#1e3a8a

/* Darker blue */
#0f40a0

/* Cyan accent */
#06b6d4

/* Background */
#0f172a
```

Search and replace to change theme!

---

## 📚 READ THESE FILES

1. **FINAL_SUMMARY.md** ← Start here
2. **COMPLETE_EXPLANATION_AND_TESTING.md** ← Full setup
3. **VISUAL_DIAGRAMS.md** ← See how it works
4. **QUICK_REFERENCE.md** ← Concepts

---

## ⏱️ TIME ESTIMATES

| Task | Time |
|------|------|
| Install Python/Node | 10 min |
| Create database | 5 min |
| Setup backend | 10 min |
| Setup frontend | 15 min |
| Test it | 5 min |
| **Total** | **45 min** |

---

## 🎓 TECH STACK

Frontend: React, JavaScript, Tailwind CSS (or plain CSS)
Backend: Flask, Python, OpenAI API
Database: SQLite or PostgreSQL
Communication: HTTP/REST, JSON

---

## 🔐 SECURITY TIPS

- Never share your .env file
- Never commit .env to git
- Never share your OpenAI API key
- Database file contains your data (keep safe)
- Only SELECT queries allowed (safe)

---

## 📞 NEED HELP?

1. Check COMPLETE_EXPLANATION_AND_TESTING.md
2. Look at VISUAL_DIAGRAMS.md
3. Check error messages carefully
4. Read backend terminal output
5. Check browser console (F12)

---

**You've got this!** 🚀

Print this card and keep it handy!
