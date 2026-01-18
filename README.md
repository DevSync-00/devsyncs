# 🚀 DevSync.AI

**AI-powered database schema synchronization tool** that automatically detects mismatches between code and database schemas, generates migrations, and provides intelligent insights. Supports 9+ schema types including Prisma, Supabase, and more.

## ✨ Features

### Core Features
- 🔍 **Schema Scanning** - Supports 9 schema types (Prisma, Supabase, TypeORM, Kysely, Sequelize, Drizzle, Django, SQLAlchemy, Raw SQL)
- 🔬 **Schema Comparison** - Intelligent diff engine detects mismatches
- 📝 **Migration Generation** - Automatic SQL migration generation
- ▶️ **Migration Execution** - Execute migrations from dashboard
- ↪️ **Migration Rollback** - Rollback applied migrations safely
- 👥 **Team Collaboration** - Team creation, member management, project sharing
- 🤖 **AI Reasoning** - AI-powered explanations and recommendations
- 💻 **CLI Tool** - Command-line interface for automation
- 🔄 **GitHub Actions** - CI/CD integration for automated scanning

### Security
- 🔒 Security headers (HSTS, CSP, XSS protection)
- ✅ Input validation and sanitization
- 🛡️ Complete access control
- 🔐 Team-based permissions
- 🚫 Safe error handling

### Performance
- ⚡ Optimized database queries
- 📦 Batch fetching
- 📄 Projects pagination
- 🔄 Lazy loading
- ⏳ Suspense boundaries

### UX/UI
- 💀 Loading skeletons
- 🛡️ Error boundaries
- 📱 Responsive design
- 🎨 Consistent design patterns

---

## 🚀 Quick Start

### Dashboard

```bash
# Install dependencies
cd apps/dashboard
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run development server
npm run dev
```

Visit `http://localhost:3000`

### CLI

```bash
# Install CLI
cd packages/cli
npm install
npm run build

# Global install
npm link

# Use CLI
devsync scan --path ./my-project --db postgresql://...
devsync migrate --path ./my-project --db postgresql://...
```

---

## 📚 Documentation

- 📖 [User Guide](./apps/dashboard/docs/USER_GUIDE.md)
- 🔌 [API Reference](./apps/dashboard/docs/API_REFERENCE.md)
- ⚙️ [Migration Execution Guide](./apps/dashboard/docs/MIGRATION_EXECUTION_GUIDE.md)
- 📊 [Migration History Guide](./apps/dashboard/docs/MIGRATION_HISTORY_GUIDE.md)
- ✅ [Best Practices](./apps/dashboard/docs/BEST_PRACTICES.md)
- 🔧 [Troubleshooting](./apps/dashboard/TROUBLESHOOTING.md)

---

## 🏗️ Project Structure

```
devsync.ai/
├── apps/
│   └── dashboard/          # Next.js dashboard application
│       ├── app/            # Next.js app router (pages & API)
│       ├── components/     # React components
│       ├── lib/            # Utilities and helpers
│       └── middleware.ts  # Security headers
├── packages/
│   ├── cli/                # CLI tool
│   └── ai-reasoner/        # AI reasoning engine
└── extensions/
    └── vscode/             # VSCode extension (future)
```

---

## 🛠️ Tech Stack

### Dashboard
- **Framework**: Next.js 14 (App Router)
- **UI**: React, Tailwind CSS, shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI**: OpenAI GPT-4

### CLI
- **Language**: TypeScript
- **Runtime**: Node.js
- **Schema Parsers**: Custom parsers for 9 schema types

---

## 📋 Requirements

### Dashboard
- Node.js 18+
- npm or yarn
- Supabase account

### CLI
- Node.js 18+
- Database connection (optional, for direct scanning)

---

## 🔐 Security

DevSync.AI implements comprehensive security measures:

- ✅ Security headers (HSTS, CSP, XSS protection)
- ✅ Input validation and sanitization
- ✅ Authentication required for all routes
- ✅ Team-based access control
- ✅ Row Level Security (RLS) in database
- ✅ Encrypted database connections
- ✅ Safe error handling (no sensitive data exposure)

---

## 🚢 Deployment

See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for detailed deployment instructions.

### Quick Deploy (Vercel)

1. Import repository to Vercel
2. Set environment variables
3. Deploy!

```bash
# Build and test locally first
cd apps/dashboard
npm run build
npm start
```

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📝 License

[Add your license here]

---

## 🎯 Status

**Current Status**: ✅ **100% MVP Complete & Production Ready**

- ✅ All core features implemented
- ✅ Security hardening complete
- ✅ Performance optimizations done
- ✅ Documentation complete
- ✅ Ready for production deployment

---

## 📞 Support

- 📖 [Documentation](./apps/dashboard/docs/)
- 🐛 [GitHub Issues](https://github.com/your-repo/issues)
- 💬 [Discussions](https://github.com/your-repo/discussions)

---

## 🙏 Acknowledgments

Built with ❤️ using:
- Next.js
- Supabase
- OpenAI
- TypeScript
- Tailwind CSS

---

**DevSync.AI** - Keep your schemas in sync, automatically! 🚀
