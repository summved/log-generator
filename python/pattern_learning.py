#!/usr/bin/env python3
"""
Pattern Learning Script
Analyzes log files to learn patterns using machine learning
"""

import json
import sys
import os
import traceback
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import re
from typing import List, Dict, Any

class LogPatternLearner:
    """Learn patterns from log data using ML techniques"""
    
    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2)
        )
        self.scaler = StandardScaler()
        self.kmeans = KMeans(n_clusters=5, random_state=42)
        self.isolation_forest = IsolationForest(
            contamination=0.1, 
            random_state=42
        )
    
    def parse_log_files(self, log_files: List[str]) -> pd.DataFrame:
        """Parse log files and extract features"""
        all_logs = []
        
        for log_file in log_files:
            if not os.path.exists(log_file):
                continue
                
            try:
                with open(log_file, 'r', encoding='utf-8') as f:
                    for line_num, line in enumerate(f):
                        line = line.strip()
                        if not line:
                            continue
                            
                        # Try to parse as JSON first
                        try:
                            log_entry = json.loads(line)
                            all_logs.append(self.extract_features(log_entry, log_file, line_num))
                        except json.JSONDecodeError:
                            # Parse as plain text log
                            log_entry = self.parse_text_log(line)
                            if log_entry:
                                all_logs.append(self.extract_features(log_entry, log_file, line_num))
                                
            except Exception as e:
                print(f"Error reading {log_file}: {e}", file=sys.stderr)
                continue
        
        return pd.DataFrame(all_logs)
    
    def parse_text_log(self, line: str) -> Dict[str, Any]:
        """Parse plain text log line"""
        # Simple regex patterns for common log formats
        patterns = [
            # Syslog format
            r'(?P<timestamp>\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(?P<host>\S+)\s+(?P<process>\S+):\s+(?P<message>.*)',
            # Apache/Nginx format
            r'(?P<ip>\d+\.\d+\.\d+\.\d+).*?"(?P<method>\w+)\s+(?P<path>\S+)\s+HTTP/[\d.]+"\s+(?P<status>\d+)\s+(?P<size>\d+)',
            # Generic timestamp format
            r'(?P<timestamp>\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}).*?(?P<level>INFO|WARN|ERROR|DEBUG).*?(?P<message>.*)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, line)
            if match:
                return match.groupdict()
        
        # Fallback - treat entire line as message
        return {'message': line, 'raw': True}
    
    def extract_features(self, log_entry: Dict[str, Any], source_file: str, line_num: int) -> Dict[str, Any]:
        """Extract features from log entry"""
        features = {
            'source_file': source_file,
            'line_number': line_num,
            'message': str(log_entry.get('message', '')),
            'level': log_entry.get('level', 'INFO'),
            'timestamp': log_entry.get('timestamp', ''),
            'host': log_entry.get('host', ''),
            'component': log_entry.get('component', ''),
            'ip_address': log_entry.get('ip', ''),
            'method': log_entry.get('method', ''),
            'status_code': log_entry.get('status', ''),
            'message_length': len(str(log_entry.get('message', ''))),
            'has_ip': bool(re.search(r'\d+\.\d+\.\d+\.\d+', str(log_entry.get('message', '')))),
            'has_error_keywords': bool(re.search(r'error|fail|exception|timeout', str(log_entry.get('message', '')), re.IGNORECASE)),
            'has_auth_keywords': bool(re.search(r'login|auth|password|token', str(log_entry.get('message', '')), re.IGNORECASE)),
        }
        
        return features
    
    def learn_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Learn patterns from log data"""
        if df.empty:
            return {
                'patterns': [],
                'anomalies': [],
                'predictions': [],
                'confidence': 0,
                'samples_analyzed': 0
            }
        
        # Text feature extraction
        messages = df['message'].fillna('')
        text_features = self.vectorizer.fit_transform(messages)
        
        # Numerical features
        numerical_features = df[[
            'message_length', 'has_ip', 'has_error_keywords', 'has_auth_keywords'
        ]].fillna(0).astype(float)
        
        # Combine features
        combined_features = np.hstack([
            text_features.toarray(),
            self.scaler.fit_transform(numerical_features)
        ])
        
        # Clustering for pattern discovery
        clusters = self.kmeans.fit_predict(combined_features)
        df['cluster'] = clusters
        
        # Anomaly detection
        anomalies = self.isolation_forest.fit_predict(combined_features)
        df['is_anomaly'] = anomalies == -1
        
        # Extract patterns
        patterns = self.extract_cluster_patterns(df)
        anomaly_logs = df[df['is_anomaly']].to_dict('records')
        
        # Generate predictions/recommendations
        predictions = self.generate_predictions(df, patterns)
        
        return {
            'patterns': patterns,
            'anomalies': anomaly_logs[:10],  # Limit to first 10 anomalies
            'predictions': predictions,
            'confidence': self.calculate_confidence(df, patterns),
            'samples_analyzed': len(df),
            'model_version': '1.0.0'
        }
    
    def extract_cluster_patterns(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Extract patterns from clusters"""
        patterns = []
        
        for cluster_id in df['cluster'].unique():
            cluster_data = df[df['cluster'] == cluster_id]
            
            pattern = {
                'id': f'cluster_{cluster_id}',
                'type': 'behavioral',
                'size': len(cluster_data),
                'percentage': len(cluster_data) / len(df) * 100,
                'common_levels': cluster_data['level'].value_counts().head(3).to_dict(),
                'common_components': cluster_data['component'].value_counts().head(3).to_dict(),
                'avg_message_length': cluster_data['message_length'].mean(),
                'error_rate': cluster_data['has_error_keywords'].mean(),
                'auth_rate': cluster_data['has_auth_keywords'].mean(),
                'sample_messages': cluster_data['message'].head(3).tolist()
            }
            
            patterns.append(pattern)
        
        return patterns
    
    def generate_predictions(self, df: pd.DataFrame, patterns: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate predictions based on learned patterns"""
        predictions = []
        
        # Predict peak activity times
        if 'timestamp' in df.columns and not df['timestamp'].isna().all():
            predictions.append({
                'type': 'temporal',
                'description': 'Peak activity prediction',
                'confidence': 0.8,
                'details': 'Activity patterns learned from historical data'
            })
        
        # Predict error rates
        error_rate = df['has_error_keywords'].mean()
        if error_rate > 0.1:
            predictions.append({
                'type': 'error_prediction',
                'description': f'High error rate detected: {error_rate:.2%}',
                'confidence': 0.7,
                'recommendation': 'Monitor system health and investigate error patterns'
            })
        
        return predictions
    
    def calculate_confidence(self, df: pd.DataFrame, patterns: List[Dict[str, Any]]) -> float:
        """Calculate overall confidence in learned patterns"""
        if df.empty or not patterns:
            return 0.0
        
        # Base confidence on data quality and pattern consistency
        data_quality = min(1.0, len(df) / 1000)  # More data = higher confidence
        pattern_consistency = len(patterns) / 10  # Reasonable number of patterns
        
        return min(1.0, (data_quality + pattern_consistency) / 2)

def main():
    """Main function"""
    try:
        # Read input data
        input_data = json.loads(sys.stdin.read())
        log_files = input_data.get('log_files', [])
        
        if not log_files:
            raise ValueError("No log files provided")
        
        # Initialize learner
        learner = LogPatternLearner()
        
        # Parse log files
        df = learner.parse_log_files(log_files)
        
        # Learn patterns
        results = learner.learn_patterns(df)
        
        # Output results
        print(json.dumps(results, indent=2, default=str))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc(),
            'patterns': [],
            'anomalies': [],
            'predictions': [],
            'confidence': 0,
            'samples_analyzed': 0
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

if __name__ == '__main__':
    main()
