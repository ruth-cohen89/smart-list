# My Project

פרויקט Node.js + TypeScript עם MongoDB, עם מבנה מודולרי של layers: Controller, Service, Repository.  
כולל סביבת פיתוח עם ts-node-dev ופרודקשן עם build ל־JS.

---

## Environment Variables


Create the following files with your own values:

**Development (`.env.development`)**
```env
NODE_ENV=development
PORT=3000
DB_URI=<your-development-mongodb-uri>
JWT_SECRET=<your-development-jwt-secret>
```

**Production (`.env.production`)**
```env
NODE_ENV=production
PORT=80
DB_URI=<your-production-mongodb-uri>
JWT_SECRET=<your-production-jwt-secret>
```

## Run

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm run start
```