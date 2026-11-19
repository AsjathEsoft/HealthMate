# HealthMate – Mobile Health Tracking Application

HealthMate is a mobile health tracking application built for a university software development assignment. Users can register, log in securely, record daily steps, calories burned, and water intake, manage daily goals, customize light/dark themes, and configure reminder notifications.

## Technology Stack

- **Frontend:** React Native, Expo, TypeScript (`mobile/`)
- **Backend:** Java 21, Spring Boot, Maven (`backend/`)
- **Database:** SQLite (`health_records.db`)
- **Communication:** JSON REST API (`fetch()` + Bearer Token authentication)

## Project Structure

```text
HealthMate/
├── backend/                  # Java Spring Boot REST API backend
│   ├── src/main/java/        # Controllers, Services, Models, SQLite JDBC connection
│   ├── src/main/resources/   # application.properties
│   ├── pom.xml               # Maven configuration
│   └── mvnw.cmd              # Maven Wrapper (Windows)
├── mobile/                   # React Native + Expo mobile application
│   ├── assets/               # App icons and bundled fallback SQLite database
│   ├── scripts/              # SQLite helper scripts
│   ├── src/                  # Screens, Components, Context, Database, Navigation, Services, Utils
│   ├── App.tsx
│   ├── index.ts
│   └── package.json
├── health_records.db         # Shared SQLite database
├── .gitignore
└── README.md
```

## How to Run

### 1. Start the Java Backend

Open a terminal in `backend/` and run:

```powershell
cd backend
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\mvnw.cmd spring-boot:run
```

The backend runs on `http://localhost:8085` (Android Emulator connects via `http://10.0.2.2:8085`).
Verify server status at `http://localhost:8085/api/health`.

### 2. Start the Mobile Application

Open a second terminal in `mobile/` and run:

```powershell
cd mobile
npm install
npx expo start --android
```

To test on a physical phone over Wi-Fi, copy `mobile/.env.example` to `mobile/.env` and set `EXPO_PUBLIC_API_URL=http://<YOUR_PC_LAN_IP>:8085`.

## Key Features

- User registration, login, salted SHA-256 password hashing, and HMAC-SHA256 Bearer token sessions
- Daily health records (Add, View, Filter by date, Edit, Delete)
- Dashboard with daily steps progress ring, calories burned, and water intake progress bars
- Customizable daily goals and profile editing (display name, email, profile photo)
- Local water and daily logging reminder notifications
- Light, Dark, and System theme modes
- Offline-first resilience: local SQLite cache + automatic offline-to-server synchronization when the Java backend reconnects
