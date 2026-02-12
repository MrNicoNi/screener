# Screener 2.0 - Documentation Hub

Welcome to the complete documentation for the **Screener** analyst evaluation system.

## 📚 Documentation Index

### For Stakeholders & Product Managers
- 📊 **[Executive Summary](./00_EXECUTIVE_SUMMARY.md)** - High-level overview, business value, and current status

### For Engineers & Architects
- 🏗️ **[Architecture](./01_ARCHITECTURE.md)** - System design, tech stack, and data flow
- ⚙️ **[Setup Guide](./02_SETUP.md)** - Get the project running locally
- 📁 **[Directory Structure](./03_DIRECTORY_STRUCTURE.md)** - Navigate the codebase
- 🔑 **[Key Components](./04_KEY_COMPONENTS.md)** - Deep dive into critical code paths
- 📦 **[Dependencies](./05_DEPENDENCIES.md)** - Libraries and external services
- ⚠️ **[Lessons Learned](./06_LESSONS_LEARNED.md)** - Critical mistakes to avoid in 2.0

### For Operations & DevOps
- 🚀 **[Deployment Guide](./07_DEPLOYMENT.md)** - Production deployment checklist

---

## 🎯 Quick Start

**New to the project?** Start here:
1. Read the [Executive Summary](./00_EXECUTIVE_SUMMARY.md) to understand what Screener does
2. Follow the [Setup Guide](./02_SETUP.md) to run it locally
3. Review [Key Components](./04_KEY_COMPONENTS.md) to understand the critical paths

**Planning Screener 2.0?** Read this:
1. [Lessons Learned](./06_LESSONS_LEARNED.md) - **MUST READ** before starting 2.0
2. [Architecture](./01_ARCHITECTURE.md) - Current system design and pain points
3. [Dependencies](./05_DEPENDENCIES.md) - What worked and what didn't

---

## 📌 Project Status

- **Version**: 1.0 (MVP)
- **Status**: 🔶 Partially Functional (blocked by RLS issues)
- **Last Updated**: 2026-01-16
- **Critical Blockers**: 3 (RLS recursion, Edge Function JWT, User Update persistence)

---

## 🚨 Known Critical Issues

> [!WARNING]
> The current version has **3 critical blockers** that prevent production use:
> 1. **RLS Recursion Deadlock** - Application hangs on auth initialization
> 2. **User Update Not Persisting** - UI shows success but database doesn't update
> 3. **Edge Function 401 Errors** - User creation and password reset fail

See [Lessons Learned](./06_LESSONS_LEARNED.md) for detailed analysis and solutions for 2.0.

---

*Last Updated: 2026-01-16 11:00 BRT*
