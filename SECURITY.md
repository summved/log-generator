# Security Guidelines

## Dependency Security

This project follows strict security practices to ensure **ALL** dependencies are downloaded from authentic sources across all package managers and systems.

### 1. NPM Dependencies (Node.js Packages)

All Node.js dependencies are configured to be downloaded exclusively from the official npm registry (`registry.npmjs.org`).

### 2. Docker Base Images

All Docker images use official, verified base images with SHA256 digests for immutable builds:
- **Node.js**: Official `node:20-alpine` from Docker Hub
- **Prometheus**: Official `prom/prometheus` from Docker Hub  
- **Grafana**: Official `grafana/grafana` from Docker Hub
- **Elasticsearch**: Official images from `docker.elastic.co`
- **Wazuh**: Official `wazuh/wazuh-manager` from Docker Hub

### 3. GitHub Actions Dependencies

All GitHub Actions use official, verified actions:
- **actions/checkout@v4**: Official GitHub action
- **actions/setup-node@v4**: Official GitHub action
- **docker/setup-buildx-action@v3**: Official Docker action
- **aquasecurity/trivy-action@master**: Official Trivy security scanner

### 4. System Package Dependencies

Alpine Linux packages (used in Docker containers) are installed from official Alpine repositories:
- **apk packages**: Only from official Alpine package repository
- **dumb-init**: Official Alpine package for proper signal handling

#### Configuration Files

1. **`.npmrc`** - Project-level npm configuration that enforces:
   - Official npm registry usage
   - Package signature verification when available
   - Security audit level settings
   - Exact version saving for better security

2. **`package.json`** - Contains security-related configurations:
   - `publishConfig.registry` - Ensures publishing to official registry
   - `config.registry` - Fallback registry configuration
   - Security-related scripts for auditing and checking dependencies

### Security Scripts

The following npm scripts are available for comprehensive security management:

```bash
# Run security audit
npm run security:audit

# Automatically fix security vulnerabilities
npm run security:audit-fix

# Check installed dependencies
npm run security:check-deps

# Check for outdated packages
npm run security:outdated

# Comprehensive dependency verification (all sources)
npm run security:verify
```

### Verification Process

#### 1. NPM Registry Verification
All dependencies in `package-lock.json` are verified to come from `https://registry.npmjs.org/`.

#### 2. Docker Image Verification
- All Docker images use SHA256 digests for immutable builds
- Base images are from official, verified sources
- Container security scanning with Trivy

#### 3. GitHub Actions Verification
- All actions use official, verified sources
- Actions are pinned to specific versions
- Security scanning integrated into CI/CD pipeline

#### 4. System Package Verification
- Alpine packages from official repositories only
- Package integrity verification during installation

#### 5. Dependency Audit
Regular security audits are performed using multiple tools:
- `npm audit` for Node.js dependencies
- `trivy` for container and filesystem scanning
- GitHub Security Advisories integration

#### 6. Version Management
- Exact versions are used where possible to prevent unexpected updates
- SHA256 digests for Docker images ensure immutable builds
- Regular updates are performed in a controlled manner
- Dependencies are reviewed before updates

### Best Practices

1. **Always use official npm registry**
   - Never use third-party or private registries for public packages
   - Verify registry URLs in package-lock.json

2. **Regular Security Audits**
   - Run `npm audit` regularly
   - Address high and critical vulnerabilities immediately
   - Keep dependencies up to date

3. **Version Control**
   - Use exact versions for critical dependencies
   - Review dependency updates before applying
   - Test thoroughly after dependency updates

4. **Monitoring**
   - Monitor security advisories for used packages
   - Subscribe to security notifications
   - Use automated security scanning tools

### Comprehensive Verification

To verify all dependencies are from authentic sources:

```bash
# Comprehensive verification script (all dependency types)
npm run security:verify

# Manual verification commands:

# 1. Check NPM packages
grep "resolved" package-lock.json | grep -v "registry.npmjs.org" || echo "All NPM packages from official registry"

# 2. Check Docker images
docker images --digests | grep log-generator

# 3. Run security audit
npm audit

# 4. Check for outdated packages
npm outdated

# 5. Scan containers for vulnerabilities
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image log-generator:latest
```

### Incident Response

If a security vulnerability is discovered:

1. **Immediate Assessment**
   - Determine the severity and impact
   - Check if the vulnerability affects the project

2. **Remediation**
   - Update the affected package to a secure version
   - If no secure version exists, consider alternatives
   - Test the application after updates

3. **Documentation**
   - Document the vulnerability and remediation steps
   - Update security guidelines if necessary

### Supply Chain Security

To protect against supply chain attacks:

1. **Package Integrity**
   - Verify package signatures when available
   - Use package-lock.json to ensure consistent installs
   - Monitor for unexpected changes in dependencies

2. **Dependency Analysis**
   - Regularly review direct and transitive dependencies
   - Remove unused dependencies
   - Prefer well-maintained packages with good security records

3. **Build Security**
   - Use secure build environments
   - Verify build artifacts
   - Implement security scanning in CI/CD pipelines

### Reporting Security Issues

If you discover a security vulnerability in this project:

1. **Do not** create a public issue
2. Contact the maintainers privately
3. Provide detailed information about the vulnerability
4. Allow time for assessment and remediation before public disclosure

---

**Last Updated:** September 2025
**Review Schedule:** Quarterly security review and update of this document
