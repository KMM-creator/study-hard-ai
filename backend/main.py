from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
import datetime
import json
import uuid
import os
import google.generativeai as genai
from groq import Groq
from dotenv import load_dotenv

# --- НАСТРОЙКА ИИ ---
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")
if API_KEY:
    genai.configure(api_key=API_KEY)

groq_key = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=groq_key) if groq_key else None

app = FastAPI(title="Study Hard AI")

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND = BASE_DIR / "frontend"
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
EVENTS_FILE = DATA_DIR / "events.json"
SUBJECTS_FILE = DATA_DIR / "subjects.json"
GOALS_FILE = DATA_DIR / "goals.json"
SETTINGS_FILE = DATA_DIR / "settings.json"
POMODOROS_FILE = DATA_DIR / "pomodoros.json"

DEFAULT_SETTINGS = {
    "reminder_before_event": True,
    "morning_summary": True,
    "evening_goals_check": True,
    "gpa_drop_warning": True,
}

def percent_to_grade(percent: float) -> float:
    if percent >= 90: return 10.0
    if percent >= 85: return 9.0
    if percent >= 80: return 8.0
    if percent >= 75: return 7.0
    if percent >= 70: return 6.0
    if percent >= 65: return 5.0
    if percent >= 60: return 4.0
    if percent >= 55: return 3.0
    if percent >= 50: return 2.0
    return 1.0

def grade_to_gpa(grade: float) -> float:
    if grade >= 9: return 4.0
    if grade >= 8: return 3.7
    if grade >= 7: return 3.3
    if grade >= 6: return 3.0
    if grade >= 5: return 2.7
    if grade >= 4: return 2.3
    if grade >= 3: return 2.0
    return 0.0

class Event(BaseModel):
    title: str
    date: str
    time: str
    type: str = "study"

class Subject(BaseModel):
    name: str

class Goal(BaseModel):
    title: str
    deadline: str
    target: int = 1
    current: int = 0

class Settings(BaseModel):
    reminder_before_event: bool = True
    morning_summary: bool = True
    evening_goals_check: bool = True
    gpa_drop_warning: bool = True

class Pomodoro(BaseModel):
    subject_id: str
    subject_name: str
    date: str

class GradeRequest(BaseModel):
    score: float
    max_score: float
    type: str = "formative"

class AIRequest(BaseModel):
    message: str

def load_json(path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default

def save_json(path, data):
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

def calculate_subject_grade(grades_list):
    formative, sor, soch = [], [], []

    for g in grades_list:
        if isinstance(g, dict):
            g_type = g.get("type", "formative")
            score = g.get("score", 0)
            max_score = g.get("max_score", 10)
        else:
            g_type = "formative"
            score = float(g)
            max_score = 10.0

        if max_score > 0:
            percent = (score / max_score) * 100
        else:
            percent = 0

        if g_type == "formative": formative.append(percent)
        elif g_type == "sor": sor.append(percent)
        elif g_type == "soch": soch.append(percent)

    total_weight = 0
    total_percent = 0

    if formative:
        total_percent += (sum(formative) / len(formative)) * 0.25
        total_weight += 0.25
    if sor:
        total_percent += (sum(sor) / len(sor)) * 0.25
        total_weight += 0.25
    if soch:
        total_percent += (sum(soch) / len(soch)) * 0.50
        total_weight += 0.50

    if total_weight == 0:
        return None, None, None

    final_percent = total_percent / total_weight
    final_grade = percent_to_grade(final_percent)
    final_gpa = grade_to_gpa(final_grade)

    return round(final_percent, 1), round(final_grade, 2), round(final_gpa, 2)

@app.get("/api/time")
def get_time():
    now = datetime.datetime.now()
    return {
        "time": now.strftime("%H:%M:%S"),
        "date": now.strftime("%d.%m.%Y"),
        "iso": now.strftime("%Y-%m-%d"),
        "weekday": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][now.weekday()],
    }

# ---------- EVENTS ----------
@app.get("/api/events")
def get_events(date: str | None = None):
    events = load_json(EVENTS_FILE, [])
    if date:
        events = [e for e in events if e["date"] == date]
    events.sort(key=lambda e: (e["date"], e["time"]))
    return {"events": events}

@app.post("/api/events")
def add_event(event: Event):
    events = load_json(EVENTS_FILE, [])
    new_event = event.dict()
    new_event["id"] = str(uuid.uuid4())
    events.append(new_event)
    save_json(EVENTS_FILE, events)
    return {"status": "ok", "event": new_event}

@app.delete("/api/events/{event_id}")
def delete_event(event_id: str):
    events = load_json(EVENTS_FILE, [])
    new_events = [e for e in events if e["id"] != event_id]
    if len(new_events) == len(events):
        raise HTTPException(status_code=404, detail="Event not found")
    save_json(EVENTS_FILE, new_events)
    return {"status": "ok"}

# ---------- SUBJECTS ----------
@app.get("/api/subjects")
def get_subjects():
    subjects = load_json(SUBJECTS_FILE, [])
    enriched = []
    total_gpa_sum = 0.0
    total_gpa_count = 0

    for s in subjects:
        grades = s.get("grades", [])
        percent, grade, gpa = calculate_subject_grade(grades)

        if gpa is not None:
            total_gpa_sum += gpa
            total_gpa_count += 1

        enriched.append({
            "id": s["id"],
            "name": s["name"],
            "grades": grades,
            "percent": percent,
            "grade10": grade,
            "gpa": gpa,
        })

    overall_gpa = round(total_gpa_sum / total_gpa_count, 2) if total_gpa_count else None
    return {
        "subjects": enriched,
        "overall_gpa": overall_gpa,
        "total_subjects": len(subjects),
    }

@app.post("/api/subjects")
def add_subject(subject: Subject):
    subjects = load_json(SUBJECTS_FILE, [])
    new_subject = {
        "id": str(uuid.uuid4()),
        "name": subject.name,
        "grades": []
    }
    subjects.append(new_subject)
    save_json(SUBJECTS_FILE, subjects)
    return {"status": "ok", "subject": new_subject}

@app.delete("/api/subjects")
def clear_all_subjects():
    save_json(SUBJECTS_FILE, [])
    return {"status": "ok"}

@app.delete("/api/subjects/{subject_id}")
def delete_subject(subject_id: str):
    subjects = load_json(SUBJECTS_FILE, [])
    new_subjects = [s for s in subjects if s["id"] != subject_id]
    if len(new_subjects) == len(subjects):
        raise HTTPException(status_code=404, detail="Subject not found")
    save_json(SUBJECTS_FILE, new_subjects)
    return {"status": "ok"}

@app.post("/api/subjects/{subject_id}/grades")
def add_grade(subject_id: str, req: GradeRequest):
    if req.score < 0 or req.score > req.max_score:
        raise HTTPException(status_code=400, detail="Score must be between 0 and max_score")
    subjects = load_json(SUBJECTS_FILE, [])
    for s in subjects:
        if s["id"] == subject_id:
            if "grades" not in s: s["grades"] = []
            s["grades"].append({
                "score": req.score,
                "max_score": req.max_score,
                "type": req.type
            })
            save_json(SUBJECTS_FILE, subjects)
            return {"status": "ok", "subject": s}
    raise HTTPException(status_code=404, detail="Subject not found")

@app.delete("/api/subjects/{subject_id}/grades/{index}")
def delete_grade(subject_id: str, index: int):
    subjects = load_json(SUBJECTS_FILE, [])
    for s in subjects:
        if s["id"] == subject_id:
            if 0 <= index < len(s["grades"]):
                s["grades"].pop(index)
                save_json(SUBJECTS_FILE, subjects)
                return {"status": "ok", "subject": s}
            raise HTTPException(status_code=404, detail="Grade not found")
    raise HTTPException(status_code=404, detail="Subject not found")

# ---------- GOALS ----------
@app.get("/api/goals")
def get_goals():
    return {"goals": load_json(GOALS_FILE, [])}

@app.post("/api/goals")
def add_goal(goal: Goal):
    goals = load_json(GOALS_FILE, [])
    new_goal = {
        "id": str(uuid.uuid4()),
        "title": goal.title,
        "deadline": goal.deadline,
        "target": goal.target,
        "current": goal.current,
    }
    goals.append(new_goal)
    save_json(GOALS_FILE, goals)
    return {"status": "ok", "goal": new_goal}

@app.patch("/api/goals/{goal_id}/progress")
def update_goal_progress(goal_id: str, delta: int):
    goals = load_json(GOALS_FILE, [])
    for g in goals:
        if g["id"] == goal_id:
            g["current"] = max(0, min(g["target"], g["current"] + delta))
            save_json(GOALS_FILE, goals)
            return {"status": "ok", "goal": g}
    raise HTTPException(status_code=404, detail="Goal not found")

@app.delete("/api/goals/{goal_id}")
def delete_goal(goal_id: str):
    goals = load_json(GOALS_FILE, [])
    new_goals = [g for g in goals if g["id"] != goal_id]
    if len(new_goals) == len(goals):
        raise HTTPException(status_code=404, detail="Goal not found")
    save_json(GOALS_FILE, new_goals)
    return {"status": "ok"}

# ---------- SETTINGS ----------
@app.get("/api/settings")
def get_settings():
    return load_json(SETTINGS_FILE, DEFAULT_SETTINGS)

@app.post("/api/settings")
def save_settings(settings: Settings):
    save_json(SETTINGS_FILE, settings.dict())
    return {"status": "ok", "settings": settings.dict()}

# ---------- POMODOROS ----------
@app.get("/api/pomodoros")
def get_pomodoros(date: str | None = None):
    pomodoros = load_json(POMODOROS_FILE, [])
    if date:
        pomodoros = [p for p in pomodoros if p["date"] == date]
    by_subject = {}
    for p in pomodoros:
        key = p["subject_id"]
        if key not in by_subject:
            by_subject[key] = {
                "subject_id": p["subject_id"],
                "subject_name": p["subject_name"],
                "count": 0,
            }
        by_subject[key]["count"] += 1
    return {
        "pomodoros": pomodoros,
        "by_subject": list(by_subject.values()),
        "total": len(pomodoros),
    }

@app.post("/api/pomodoros")
def add_pomodoro(pom: Pomodoro):
    pomodoros = load_json(POMODOROS_FILE, [])
    new_pom = {
        "id": str(uuid.uuid4()),
        "subject_id": pom.subject_id,
        "subject_name": pom.subject_name,
        "date": pom.date,
        "created_at": datetime.datetime.now().isoformat(),
    }
    pomodoros.append(new_pom)
    save_json(POMODOROS_FILE, pomodoros)
    return {"status": "ok", "pomodoro": new_pom}

@app.delete("/api/pomodoros")
def clear_all_pomodoros():
    save_json(POMODOROS_FILE, [])
    return {"status": "ok"}

# ---------- AI ----------
@app.post("/api/ai/chat")
def ai_chat(req: AIRequest):
    subjects = load_json(SUBJECTS_FILE, [])
    goals = load_json(GOALS_FILE, [])
    
    context = "Ты - умный ассистент Study Hard. Помогай пользователю учиться. Вот его данные:\n"
    context += f"Предметы и оценки: {json.dumps(subjects, ensure_ascii=False)}\n"
    context += f"Цели: {json.dumps(goals, ensure_ascii=False)}\n"
    context += "Отвечай кратко, по делу. НЕ используй HTML-таблицы. Если пользователь не просит расписать учебу по минутам, не делай этого. Используй только списки и HTML-теги <mark> для выделения важных вещей (дат, оценок)."

    # --- ВЫБОР МОДЕЛИ: GROQ (быстро) или GEMINI (умно) ---
    USE_GROQ = False  # ВЫКЛЮЧЕНО! Теперь работает Gemini.

    if USE_GROQ and groq_client:
        try:
            chat_completion = groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": context},
                    {"role": "user", "content": req.message}
                ],
                model="qwen/qwen3.8-27b",
                temperature=0.7,
            )
            return {"reply": chat_completion.choices[0].message.content}
        except Exception as e:
            print(f"!!! ОШИБКА GROQ: {e}")
            raise HTTPException(status_code=500, detail="Groq generation failed")
    
    else:
        if not API_KEY:
            raise HTTPException(status_code=500, detail="API key not configured")
        try:
            model = genai.GenerativeModel('gemini-3.8-flash')
            response = model.generate_content(context + "\nВопрос пользователя: " + req.message)
            return {"reply": response.text}
        except Exception as e:
            print(f"!!! ОШИБКА GEMINI: {e}")
            raise HTTPException(status_code=500, detail="Gemini generation failed")

# ---------- FRONTEND ----------
@app.get("/")
def index():
    return FileResponse(FRONTEND / "index.html")

app.mount("/", StaticFiles(directory=FRONTEND), name="static")