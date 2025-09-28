#!/usr/bin/env python3
"""
ML Dependencies Verification Script
Verifies that all required ML libraries are installed and working
"""

import json
import sys
import traceback

def verify_dependencies():
    """Verify all ML dependencies are available and working"""
    results = {
        'success': False,
        'dependencies': {},
        'errors': []
    }
    
    # Core ML libraries
    dependencies = {
        'numpy': 'numpy',
        'pandas': 'pandas', 
        'scikit-learn': 'sklearn',
        'statsmodels': 'statsmodels',
        'joblib': 'joblib',
        'requests': 'requests'
    }
    
    for name, import_name in dependencies.items():
        try:
            module = __import__(import_name)
            version = getattr(module, '__version__', 'unknown')
            results['dependencies'][name] = {
                'available': True,
                'version': version
            }
        except ImportError as e:
            results['dependencies'][name] = {
                'available': False,
                'error': str(e)
            }
            results['errors'].append(f"Missing dependency: {name}")
    
    # Check if all core dependencies are available
    core_deps = ['numpy', 'pandas', 'scikit-learn']
    all_core_available = all(
        results['dependencies'][dep]['available'] 
        for dep in core_deps
    )
    
    results['success'] = all_core_available
    results['core_dependencies_available'] = all_core_available
    results['total_dependencies'] = len(dependencies)
    results['available_count'] = sum(
        1 for dep in results['dependencies'].values() 
        if dep['available']
    )
    
    return results

def main():
    """Main function"""
    try:
        # Read input (not used for verification, but maintain interface)
        input_data = json.loads(sys.stdin.read() or '{}')
        
        # Verify dependencies
        results = verify_dependencies()
        
        # Output results
        print(json.dumps(results, indent=2))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

if __name__ == '__main__':
    main()
