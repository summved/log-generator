# 🏗️ Code Architecture

This document provides an overview of the project's code structure and architecture for developers.

## 📁 Project Structure

```
log-generator/
├── src/                          # Source code
│   ├── cli.ts                   # Command-line interface
│   ├── index.ts                 # Main application entry point
│   ├── LogGeneratorManager.ts   # Central orchestration class
│   │
│   ├── generators/              # Log generators for different sources
│   │   ├── BaseGenerator.ts     # Abstract base class for all generators
│   │   ├── ApplicationGenerator.ts
│   │   ├── AuthenticationGenerator.ts
│   │   ├── BackupGenerator.ts
│   │   ├── CloudGenerator.ts
│   │   ├── DatabaseGenerator.ts
│   │   ├── EmailGenerator.ts
│   │   ├── EndpointGenerator.ts
│   │   ├── FirewallGenerator.ts
│   │   ├── IoTGenerator.ts
│   │   ├── MicroservicesGenerator.ts
│   │   ├── ServerGenerator.ts
│   │   ├── WebServerGenerator.ts
│   │   └── index.ts             # Generator exports
│   │
│   ├── types/                   # TypeScript type definitions
│   │   ├── index.ts             # Core types (LogEntry, LogSource, etc.)
│   │   ├── attackChain.ts       # Attack chain simulation types
│   │   ├── aiAttackChain.ts     # AI-enhanced attack chain types
│   │   └── mlPatterns.ts        # ML pattern learning types
│   │
│   ├── utils/                   # Utility modules
│   │   ├── logger.ts            # Winston logging configuration
│   │   ├── templateEngine.ts    # Log template processing
│   │   ├── formatters.ts        # Output format handlers (JSON, Syslog, CEF)
│   │   ├── outputManager.ts     # Output destination management
│   │   ├── storage.ts           # File system operations
│   │   ├── timestampSequencer.ts # Unique timestamp generation
│   │   ├── timestampValidator.ts # Timestamp analysis and repair
│   │   └── mitreMapper.ts       # MITRE ATT&CK technique mapping
│   │
│   ├── config/                  # Configuration files
│   │   ├── index.ts             # Configuration loader
│   │   └── default.yaml         # Default log templates and sources
│   │
│   ├── replay/                  # Log replay functionality
│   │   ├── index.ts             # Replay exports
│   │   └── ReplayManager.ts     # Historical log replay engine
│   │
│   ├── chains/                  # Attack chain simulation
│   │   ├── AttackChainEngine.ts # Chain execution engine
│   │   ├── AttackChainManager.ts # Chain management and templates
│   │   ├── EnhancedAttackChainEngine.ts # AI-enhanced chain execution
│   │   ├── EnhancedAttackChainManager.ts # AI-enhanced chain management
│   │   └── templates/           # YAML attack chain definitions
│   │       ├── apt29-cozy-bear.yaml
│   │       ├── ransomware-ryuk.yaml
│   │       └── insider-threat-data-theft.yaml
│   │
│   ├── ml/                      # ML-based pattern learning
│   │   ├── PatternLearningEngine.ts # Core ML pattern learning
│   │   └── MLEnhancedLogGenerator.ts # ML-enhanced log generation
│   │
│   └── ai/                      # AI enhancement system
│       └── LocalAIOrchestrator.ts # Local AI for attack chain enhancement
│
├── logs/                        # Generated log files
│   ├── current/                 # Real-time generated logs
│   └── historical/              # Historical logs for replay/analysis
│
├── models/                      # ML models and patterns
│   ├── ml-patterns/             # Learned pattern models
│   └── local-ai/                # Local AI models and knowledge base
│
├── examples/                    # Usage examples
│   └── basic-usage.js           # Basic JavaScript usage example
│
├── scripts/                     # Utility scripts
│   └── test-install.sh          # Installation test script
│
└── docs/                        # Documentation
    ├── README.md                # Main project documentation
    ├── ADVANCED_FEATURES.md     # Detailed feature documentation
    ├── LOG_TYPES_REFERENCE.md   # Complete log types reference
    ├── CONFIGURATION.md         # Configuration guide
    ├── SIEM_INTEGRATION.md      # SIEM integration guide
    ├── SIEM_TECHNICAL_GUIDE.md  # Technical implementation guide
    ├── SYSTEM_REQUIREMENTS.md   # Performance and requirements
    └── LOG_ANALYSIS.md          # Log analysis tools
```

## 🏛️ Architecture Overview

### Core Components

#### **1. LogGeneratorManager** (`src/LogGeneratorManager.ts`)
- **Purpose**: Central orchestration class that manages all log generators
- **Responsibilities**:
  - Initialize and configure generators for each log source
  - Coordinate timing and frequency across generators
  - Apply MITRE filtering and technique mapping
  - Handle output routing and formatting
- **Key Methods**:
  - `start()` - Start all enabled generators
  - `stop()` - Stop all generators gracefully
  - `getStatus()` - Get current generation status
  - `shouldIncludeLogEntry()` - Apply MITRE filtering logic

#### **2. BaseGenerator** (`src/generators/BaseGenerator.ts`)
- **Purpose**: Abstract base class for all log generators
- **Responsibilities**:
  - Provide common generator functionality
  - Handle timing and frequency control
  - Apply MITRE technique mapping to generated logs
  - Manage generator lifecycle (start/stop)
- **Key Methods**:
  - `start(onLogGenerated)` - Start generating logs with callback
  - `stop()` - Stop generator gracefully
  - `generateLogEntry()` - Abstract method implemented by subclasses
  - `addMitreTechnique()` - Add MITRE mapping to log entries

#### **3. CLI Interface** (`src/cli.ts`)
- **Purpose**: Command-line interface using Commander.js
- **Responsibilities**:
  - Parse command-line arguments and options
  - Route commands to appropriate managers
  - Provide user-friendly command structure
- **Command Categories**:
  - **Generation**: `generate`, `status`, `config`
  - **Replay**: `replay`, `analyze`
  - **MITRE**: `mitre-list`, `mitre-coverage`
  - **Attack Chains**: `attack-chains:*` commands
  - **ML Patterns**: `ml-patterns:*` commands

### Specialized Components

#### **4. MITRE ATT&CK Integration** (`src/utils/mitreMapper.ts`)
- **Purpose**: Map log patterns to MITRE ATT&CK techniques and tactics
- **Responsibilities**:
  - Maintain technique-to-tactic mappings
  - Automatically detect techniques from log content
  - Validate MITRE technique and tactic IDs
- **Key Features**:
  - 14 supported techniques across 12 tactics
  - Automatic pattern recognition
  - Technique validation and lookup

#### **5. D3FEND Defensive Mapping** (`src/utils/d3fendMapper.ts`, `src/utils/d3fendCoverage.ts`)
- **Purpose**: Recognise defender-side events in logs and relate them to MITRE D3FEND techniques
- **Responsibilities**:
  - Hold the catalogue of 14 D3FEND techniques in 5 categories (Detect, Deny, Contain, Disrupt, Deceive), with effectiveness and automation flags
  - Map a log to a technique: a log's own `d3fend` field wins, otherwise lower-cased message phrases and some `metadata.component` values (`ids`, `ips`, `edr`, `auth-monitor`) are matched, and the first match wins
  - Suggest defences for six ATT&CK techniques (`suggestDefensesForAttack`: T1110, T1078, T1071, T1055, T1082, T1018)
  - List techniques and build coverage reports over log files (`d3fendCoverage.ts`, used by `d3fend-list` and `d3fend-coverage`)
- **Not wired in yet**: `src/generators/SecurityOperationsGenerator.ts` holds D3FEND-tagged defensive-response templates, but no command uses it, so generated logs currently contain no defender-side events

#### **6. Attack Chain Engine** (`src/chains/AttackChainEngine.ts`)
- **Purpose**: Execute multi-stage attack scenarios
- **Responsibilities**:
  - Load and validate attack chain templates
  - Execute steps with proper timing and dependencies
  - Generate logs for each attack stage
  - Handle chain abortion and error recovery
- **Key Features**:
  - YAML-based chain definitions
  - Dependency management between steps
  - Realistic timing with variance
  - Progress tracking and reporting

#### **7. ML Pattern Learning** (`src/ml/PatternLearningEngine.ts`)
- **Purpose**: Learn patterns from historical data for realistic log generation
- **Responsibilities**:
  - Analyze historical logs for user and system patterns
  - Extract behavioral characteristics and temporal patterns
  - Generate realistic anomalies based on learned patterns
  - Provide pattern-based log generation
- **Key Features**:
  - User behavior analysis (login patterns, application usage)
  - System performance modeling
  - Security event correlation
  - Configurable anomaly generation

#### **8. Replay Engine** (`src/replay/ReplayManager.ts`)
- **Purpose**: Replay historical log data with advanced features
- **Responsibilities**:
  - Parse and validate historical log files
  - Control replay speed and timing
  - Apply filtering and time range selection
  - Handle duplicate timestamps and data quality issues
- **Key Features**:
  - Speed control (0.1x to 10x)
  - Time range filtering
  - Loop and continuous replay
  - Timestamp validation and repair

### Data Flow

#### **1. Log Generation Flow**
```
CLI Command → LogGeneratorManager → BaseGenerator → TemplateEngine → OutputManager
                     ↓                    ↓              ↓             ↓
              MITRE Filtering → Template Selection → Log Entry → Format & Output
```

#### **2. Attack Chain Flow**
```
CLI Command → AttackChainManager → AttackChainEngine → LogGeneratorManager → Output
                     ↓                      ↓                    ↓
              Load Template → Execute Steps → Generate Stage Logs
```

#### **3. ML Pattern Flow**
```
Historical Data → PatternLearningEngine → MLEnhancedLogGenerator → Realistic Logs
                         ↓                        ↓
                 Learn Patterns → Apply Patterns & Generate Anomalies
```

#### **4. Replay Flow**
```
Historical File → ReplayManager → Validation → Timing Control → Output
                       ↓              ↓            ↓
                Parse Logs → Apply Filters → Replay with Speed
```

## 🔧 Key Design Patterns

### **1. Strategy Pattern**
- **Used in**: Output formatting (JSON, Syslog, CEF)
- **Implementation**: `src/utils/formatters.ts`
- **Benefit**: Easy to add new output formats

### **2. Template Method Pattern**
- **Used in**: BaseGenerator and specific generator implementations
- **Implementation**: `src/generators/BaseGenerator.ts`
- **Benefit**: Consistent generator behavior with customizable log generation

### **3. Observer Pattern**
- **Used in**: Log generation callbacks and event handling
- **Implementation**: Generator start callbacks, ML pattern events
- **Benefit**: Decoupled communication between components

### **4. Factory Pattern**
- **Used in**: Generator creation and configuration loading
- **Implementation**: `src/config/index.ts`
- **Benefit**: Centralized configuration and generator instantiation

### **5. Command Pattern**
- **Used in**: CLI command structure
- **Implementation**: `src/cli.ts`
- **Benefit**: Extensible command system with clear separation

## 🚀 Extension Points

### **Adding New Log Sources**
1. Create new generator class extending `BaseGenerator`
2. Implement `generateLogEntry()` method
3. Add log templates to `src/config/default.yaml`
4. Register in `src/generators/index.ts`
5. Update configuration types if needed

### **Adding New Output Formats**
1. Create formatter function in `src/utils/formatters.ts`
2. Add format option to CLI commands
3. Update `OutputManager` to handle new format
4. Add documentation and examples

### **Adding New MITRE Techniques**
1. Add technique mapping to `src/utils/mitreMapper.ts`
2. Update technique detection patterns
3. Add templates with MITRE mappings
4. Update documentation

### **Adding New D3FEND Techniques**
1. Add an entry to `DEFENSIVE_PATTERNS` in `src/utils/d3fendMapper.ts`
2. Add its trigger phrases to `matchesDefensivePattern`
3. Optionally add it to the `suggestDefensesForAttack` mapping
4. Update the tests in `src/utils/d3fendCoverage.test.ts` and the D3FEND section of `ADVANCED_FEATURES.md`

### **Adding New Attack Chains**
1. Create YAML template in `src/chains/templates/`
2. Define steps with MITRE mappings and timing
3. Test chain execution and validation
4. Update documentation and examples

### **Extending ML Capabilities**
1. Add new pattern types to `src/types/mlPatterns.ts`
2. Implement learning algorithms in `PatternLearningEngine`
3. Add CLI commands for new ML features
4. Update configuration options

## 🧪 Testing Architecture

### **Unit Tests**
- Generator classes: Test log generation logic
- Utility functions: Test formatting, validation, mapping
- Type validation: Ensure proper TypeScript types

### **Integration Tests**
- End-to-end log generation workflows
- SIEM integration testing
- Attack chain execution validation
- ML pattern learning and generation

### **Performance Tests**
- High-volume log generation
- Memory usage under load
- Concurrent generator performance
- Replay speed and accuracy

## 📊 Performance Considerations

### **Memory Management**
- Streaming log generation (no large buffers)
- Efficient timestamp sequencing
- Garbage collection optimization for high-volume generation

### **CPU Optimization**
- Concurrent generators with controlled timing
- Template caching and reuse
- Efficient pattern matching for MITRE mapping

### **I/O Optimization**
- Batched file writes
- Async output operations
- Network output connection pooling

### **Scalability**
- Configurable generator frequencies
- Resource usage monitoring
- Graceful degradation under load

## 🔍 Debugging and Monitoring

### **Logging Levels**
- **ERROR**: Critical failures, generation errors
- **WARN**: Performance issues, fallback scenarios
- **INFO**: Generation status, major operations
- **DEBUG**: Detailed execution flow, timing information

### **Metrics and Monitoring**
- Generation rates per source
- Memory and CPU usage
- Error rates and types
- MITRE technique coverage
- ML pattern learning progress

### **Troubleshooting**
- Status commands for real-time monitoring
- Analysis tools for log quality validation
- Timestamp validation and repair utilities
- Performance profiling capabilities

This architecture supports the project's goals of providing realistic, MITRE-mapped log generation with advanced features like attack chain simulation and ML-based pattern learning, while maintaining extensibility and performance.
