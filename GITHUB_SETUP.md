# GitHub Repository Setup Guide

## 🚀 Quick Setup Instructions

Follow these steps to upload this project to GitHub:

### 1. Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon → "New repository"
3. Repository name: `log-generator`
4. Description: "Multi-source log generator for SIEM testing with replay functionality"
5. Make it **Public** (for community use)
6. **Don't** initialize with README (we already have one)
7. Click "Create repository"

### 2. Upload Project

```bash
# Initialize git repository (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Multi-source log generator with replay functionality

- Support for 5 log sources (endpoint, application, server, firewall, cloud)
- Historical log replay with speed control and looping
- Multiple output formats (JSON, Syslog, CEF, Wazuh)
- Docker support and comprehensive CLI
- GPL-3.0 license to prevent commercial exploitation"

# Add GitHub remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/log-generator.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 3. Configure Repository Settings

After uploading, configure these GitHub settings:

#### Repository Settings
- Go to Settings → General
- Features: Enable Issues, Discussions, Projects
- Pull Requests: Enable "Automatically delete head branches"

#### Branch Protection
- Go to Settings → Branches
- Add rule for `main` branch:
  - Require pull request reviews before merging
  - Require status checks to pass before merging

#### Topics/Tags
Add these topics to help people find your project:
- `siem`
- `log-generator`
- `wazuh`
- `security-testing`
- `cybersecurity`
- `typescript`
- `docker`
- `replay`

### 4. Create Release

1. Go to Releases → "Create a new release"
2. Tag version: `v1.0.0`
3. Release title: `v1.0.0 - Initial Release`
4. Description:
```markdown
## 🎉 Initial Release

Multi-source log generator designed for SIEM testing and cybersecurity training.

### ✨ Features
- **5 Log Sources**: Endpoint, Application, Server, Firewall, Cloud
- **Replay System**: Speed control (0.1x-100x), looping, time filtering
- **Multiple Formats**: JSON, Syslog, CEF, Wazuh-optimized
- **Easy Setup**: 30-second installation script
- **Docker Ready**: Full container support
- **GPL-3.0 Licensed**: Free for non-commercial use

### 🚀 Quick Start
```bash
git clone https://github.com/YOUR_USERNAME/log-generator.git
cd log-generator
./scripts/test-install.sh
npm run generate
```

### 📊 Capacity
- **65 logs/minute** (3,900/hour) default rate
- **Configurable frequencies** per source type
- **Automatic rotation** and cleanup
- **Historical replay** with timing preservation

Perfect for SIEM testing, security training, and development workflows!
```

## 📝 Post-Upload Checklist

- [ ] Repository created and uploaded
- [ ] README.md displays correctly
- [ ] License file is visible
- [ ] Topics/tags added for discoverability
- [ ] Branch protection rules configured
- [ ] Initial release created
- [ ] Issues and Discussions enabled

## 🔗 Useful Links After Setup

- **Repository**: https://github.com/YOUR_USERNAME/log-generator
- **Issues**: https://github.com/YOUR_USERNAME/log-generator/issues
- **Discussions**: https://github.com/YOUR_USERNAME/log-generator/discussions
- **Releases**: https://github.com/YOUR_USERNAME/log-generator/releases

## 🌟 Promoting Your Project

### Share On:
- Reddit: r/cybersecurity, r/sysadmin, r/netsec
- LinkedIn: Cybersecurity groups
- Twitter: #SIEM #cybersecurity #opensource
- Discord: Security communities

### Submit To:
- Awesome Lists (awesome-security, awesome-siem)
- Product Hunt (for broader visibility)
- GitHub Explore (trending repositories)

---
**Ready to make cybersecurity testing easier for everyone!** 🚀
