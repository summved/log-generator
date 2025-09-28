#!/usr/bin/env python3
"""
Advanced ML Models for Log Generator
Python-based ML models for enhanced log analysis and generation
"""

import json
import sys
import logging
import warnings
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
import numpy as np
import pandas as pd

# Suppress warnings for cleaner output
warnings.filterwarnings('ignore')

# Core ML Libraries
try:
    from sklearn.ensemble import IsolationForest, RandomForestClassifier
    from sklearn.svm import OneClassSVM
    from sklearn.preprocessing import StandardScaler, LabelEncoder
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report, accuracy_score
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.cluster import DBSCAN
    from sklearn.decomposition import PCA
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

# Time Series Libraries
try:
    from prophet import Prophet
    from statsmodels.tsa.arima.model import ARIMA
    from statsmodels.tsa.seasonal import seasonal_decompose
    TIMESERIES_AVAILABLE = True
except ImportError:
    TIMESERIES_AVAILABLE = False

# NLP Libraries
try:
    from transformers import pipeline, AutoTokenizer, AutoModel
    import torch
    NLP_AVAILABLE = True
except ImportError:
    NLP_AVAILABLE = False

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class LogAnomalyDetector:
    """Advanced anomaly detection for log entries using multiple algorithms"""
    
    def __init__(self, contamination: float = 0.1):
        self.contamination = contamination
        self.models = {}
        self.scalers = {}
        self.feature_names = []
        self.is_trained = False
        
        if SKLEARN_AVAILABLE:
            self.models = {
                'isolation_forest': IsolationForest(
                    contamination=contamination,
                    random_state=42,
                    n_estimators=200
                ),
                'one_class_svm': OneClassSVM(
                    kernel='rbf',
                    gamma='scale',
                    nu=contamination
                )
            }
            self.scalers = {name: StandardScaler() for name in self.models.keys()}
    
    def extract_features(self, log_entries: List[Dict[str, Any]]) -> np.ndarray:
        """Extract numerical features from log entries"""
        features = []
        
        for entry in log_entries:
            feature_vector = []
            
            # Temporal features
            timestamp = pd.to_datetime(entry.get('timestamp', datetime.now()))
            feature_vector.extend([
                timestamp.hour,
                timestamp.day_of_week,
                timestamp.day,
                timestamp.month,
                int(timestamp.weekday() >= 5)  # is_weekend
            ])
            
            # Message features
            message = entry.get('message', '')
            feature_vector.extend([
                len(message),
                len(message.split()),
                message.count('error'),
                message.count('warning'),
                message.count('failed'),
                message.count('success'),
                int('authentication' in message.lower()),
                int('network' in message.lower()),
                int('database' in message.lower())
            ])
            
            # Level features
            level_map = {'DEBUG': 0, 'INFO': 1, 'WARN': 2, 'ERROR': 3, 'CRITICAL': 4}
            level = level_map.get(entry.get('level', 'INFO'), 1)
            feature_vector.append(level)
            
            # Source features
            source_name = entry.get('source', {}).get('name', '')
            feature_vector.append(hash(source_name) % 1000)
            
            # Metadata features
            metadata = entry.get('metadata', {})
            feature_vector.extend([
                len(metadata),
                int('user' in metadata),
                int('ip' in str(metadata).lower()),
                int('error' in str(metadata).lower())
            ])
            
            features.append(feature_vector)
        
        if not self.feature_names:
            self.feature_names = [
                'hour', 'day_of_week', 'day', 'month', 'is_weekend',
                'message_length', 'word_count', 'error_count', 'warning_count',
                'failed_count', 'success_count', 'has_auth', 'has_network',
                'has_database', 'log_level', 'source_hash', 'metadata_count',
                'has_user', 'has_ip', 'has_error_metadata'
            ]
        
        return np.array(features)
    
    def train(self, log_entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Train anomaly detection models"""
        if not SKLEARN_AVAILABLE:
            return {'error': 'scikit-learn not available'}
        
        try:
            features = self.extract_features(log_entries)
            results = {}
            
            for name, model in self.models.items():
                scaler = self.scalers[name]
                
                # Scale features
                features_scaled = scaler.fit_transform(features)
                
                # Train model
                model.fit(features_scaled)
                
                # Evaluate on training data
                predictions = model.predict(features_scaled)
                anomaly_scores = model.decision_function(features_scaled)
                
                results[name] = {
                    'anomalies_detected': int(np.sum(predictions == -1)),
                    'total_samples': len(features),
                    'anomaly_rate': float(np.sum(predictions == -1) / len(features)),
                    'mean_anomaly_score': float(np.mean(anomaly_scores)),
                    'std_anomaly_score': float(np.std(anomaly_scores))
                }
            
            self.is_trained = True
            logger.info(f"Anomaly detection models trained on {len(log_entries)} samples")
            
            return {
                'status': 'success',
                'models_trained': list(self.models.keys()),
                'results': results,
                'feature_count': len(self.feature_names)
            }
            
        except Exception as e:
            logger.error(f"Training failed: {str(e)}")
            return {'error': str(e)}
    
    def predict(self, log_entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Predict anomalies in log entries"""
        if not SKLEARN_AVAILABLE or not self.is_trained:
            return {'error': 'Models not available or not trained'}
        
        try:
            features = self.extract_features(log_entries)
            results = {}
            
            for name, model in self.models.items():
                scaler = self.scalers[name]
                features_scaled = scaler.transform(features)
                
                predictions = model.predict(features_scaled)
                anomaly_scores = model.decision_function(features_scaled)
                
                results[name] = {
                    'predictions': predictions.tolist(),
                    'anomaly_scores': anomaly_scores.tolist(),
                    'anomalies_detected': int(np.sum(predictions == -1)),
                    'confidence_scores': (np.abs(anomaly_scores) / np.max(np.abs(anomaly_scores))).tolist()
                }
            
            # Ensemble prediction
            ensemble_predictions = []
            ensemble_scores = []
            
            for i in range(len(log_entries)):
                votes = sum(results[name]['predictions'][i] == -1 for name in self.models.keys())
                avg_score = np.mean([results[name]['anomaly_scores'][i] for name in self.models.keys()])
                
                ensemble_predictions.append(-1 if votes >= len(self.models) / 2 else 1)
                ensemble_scores.append(avg_score)
            
            results['ensemble'] = {
                'predictions': ensemble_predictions,
                'anomaly_scores': ensemble_scores,
                'anomalies_detected': sum(1 for p in ensemble_predictions if p == -1)
            }
            
            return {
                'status': 'success',
                'results': results,
                'total_samples': len(log_entries)
            }
            
        except Exception as e:
            logger.error(f"Prediction failed: {str(e)}")
            return {'error': str(e)}


class LogTimeSeriesPredictor:
    """Time series forecasting for log patterns"""
    
    def __init__(self):
        self.prophet_model = None
        self.arima_model = None
        self.is_trained = False
    
    def prepare_time_series_data(self, log_entries: List[Dict[str, Any]]) -> pd.DataFrame:
        """Convert log entries to time series data"""
        timestamps = []
        for entry in log_entries:
            timestamp = pd.to_datetime(entry.get('timestamp', datetime.now()))
            timestamps.append(timestamp)
        
        # Create hourly aggregation
        df = pd.DataFrame({'timestamp': timestamps})
        df['count'] = 1
        df = df.set_index('timestamp').resample('H').sum().reset_index()
        df.columns = ['ds', 'y']  # Prophet format
        
        return df
    
    def train_prophet(self, log_entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Train Prophet model for log volume forecasting"""
        if not TIMESERIES_AVAILABLE:
            return {'error': 'Prophet not available'}
        
        try:
            df = self.prepare_time_series_data(log_entries)
            
            self.prophet_model = Prophet(
                yearly_seasonality=True,
                weekly_seasonality=True,
                daily_seasonality=True,
                changepoint_prior_scale=0.05
            )
            
            self.prophet_model.fit(df)
            self.is_trained = True
            
            logger.info(f"Prophet model trained on {len(df)} time points")
            
            return {
                'status': 'success',
                'model': 'prophet',
                'training_points': len(df),
                'date_range': {
                    'start': df['ds'].min().isoformat(),
                    'end': df['ds'].max().isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Prophet training failed: {str(e)}")
            return {'error': str(e)}
    
    def forecast(self, hours_ahead: int = 24) -> Dict[str, Any]:
        """Generate forecast for log volume"""
        if not TIMESERIES_AVAILABLE or not self.is_trained:
            return {'error': 'Prophet model not available or not trained'}
        
        try:
            future = self.prophet_model.make_future_dataframe(periods=hours_ahead, freq='H')
            forecast = self.prophet_model.predict(future)
            
            # Get the forecasted values
            forecast_data = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(hours_ahead)
            
            return {
                'status': 'success',
                'forecast': {
                    'timestamps': forecast_data['ds'].dt.isoformat().tolist(),
                    'predicted': forecast_data['yhat'].tolist(),
                    'lower_bound': forecast_data['yhat_lower'].tolist(),
                    'upper_bound': forecast_data['yhat_upper'].tolist()
                },
                'hours_ahead': hours_ahead
            }
            
        except Exception as e:
            logger.error(f"Forecasting failed: {str(e)}")
            return {'error': str(e)}


class LogNLPAnalyzer:
    """NLP analysis for log messages"""
    
    def __init__(self):
        self.sentiment_analyzer = None
        self.classifier = None
        self.vectorizer = None
        self.is_initialized = False
    
    def initialize(self) -> Dict[str, Any]:
        """Initialize NLP models"""
        if not NLP_AVAILABLE:
            return {'error': 'Transformers library not available'}
        
        try:
            # Initialize sentiment analysis pipeline
            self.sentiment_analyzer = pipeline(
                "sentiment-analysis",
                model="distilbert-base-uncased-finetuned-sst-2-english",
                device=0 if torch.cuda.is_available() else -1
            )
            
            self.vectorizer = TfidfVectorizer(
                max_features=1000,
                stop_words='english',
                ngram_range=(1, 2)
            )
            
            self.is_initialized = True
            
            logger.info("NLP models initialized successfully")
            
            return {
                'status': 'success',
                'models': ['sentiment_analyzer', 'vectorizer'],
                'device': 'cuda' if torch.cuda.is_available() else 'cpu'
            }
            
        except Exception as e:
            logger.error(f"NLP initialization failed: {str(e)}")
            return {'error': str(e)}
    
    def analyze_messages(self, messages: List[str]) -> Dict[str, Any]:
        """Analyze log messages for sentiment and topics"""
        if not self.is_initialized:
            init_result = self.initialize()
            if 'error' in init_result:
                return init_result
        
        try:
            results = {
                'sentiment_analysis': [],
                'message_stats': {},
                'topics': []
            }
            
            # Sentiment analysis
            for message in messages:
                sentiment = self.sentiment_analyzer(message[:512])[0]  # Limit length
                results['sentiment_analysis'].append({
                    'message': message[:100] + '...' if len(message) > 100 else message,
                    'sentiment': sentiment['label'],
                    'confidence': float(sentiment['score'])
                })
            
            # Message statistics
            all_text = ' '.join(messages)
            results['message_stats'] = {
                'total_messages': len(messages),
                'avg_length': np.mean([len(msg) for msg in messages]),
                'total_words': len(all_text.split()),
                'unique_words': len(set(all_text.lower().split())),
                'error_mentions': sum(1 for msg in messages if 'error' in msg.lower()),
                'warning_mentions': sum(1 for msg in messages if 'warning' in msg.lower())
            }
            
            # Topic extraction using TF-IDF
            if len(messages) > 1:
                tfidf_matrix = self.vectorizer.fit_transform(messages)
                feature_names = self.vectorizer.get_feature_names_out()
                
                # Get top terms
                mean_scores = np.mean(tfidf_matrix.toarray(), axis=0)
                top_indices = np.argsort(mean_scores)[-10:][::-1]
                
                results['topics'] = [
                    {
                        'term': feature_names[idx],
                        'score': float(mean_scores[idx])
                    }
                    for idx in top_indices
                ]
            
            return {
                'status': 'success',
                'results': results
            }
            
        except Exception as e:
            logger.error(f"Message analysis failed: {str(e)}")
            return {'error': str(e)}


class LogThreatIntelligence:
    """Threat intelligence analysis for IOCs in logs"""
    
    def __init__(self):
        self.ioc_patterns = {
            'ip': r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b',
            'domain': r'\b[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}\b',
            'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            'hash_md5': r'\b[a-fA-F0-9]{32}\b',
            'hash_sha1': r'\b[a-fA-F0-9]{40}\b',
            'hash_sha256': r'\b[a-fA-F0-9]{64}\b'
        }
        
        # Simple threat database (in production, this would be external feeds)
        self.known_threats = {
            'ips': ['192.168.1.100', '10.0.0.1'],
            'domains': ['malware.example.com', 'phishing.test'],
            'hashes': ['d41d8cd98f00b204e9800998ecf8427e']
        }
    
    def extract_iocs(self, log_entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Extract IOCs from log entries"""
        import re
        
        try:
            iocs = {
                'ip': set(),
                'domain': set(),
                'email': set(),
                'hash_md5': set(),
                'hash_sha1': set(),
                'hash_sha256': set()
            }
            
            for entry in log_entries:
                message = entry.get('message', '')
                metadata = str(entry.get('metadata', {}))
                text = message + ' ' + metadata
                
                for ioc_type, pattern in self.ioc_patterns.items():
                    matches = re.findall(pattern, text, re.IGNORECASE)
                    iocs[ioc_type].update(matches)
            
            # Convert sets to lists for JSON serialization
            iocs = {k: list(v) for k, v in iocs.items()}
            
            # Threat analysis
            threat_analysis = {}
            for ioc_type, ioc_list in iocs.items():
                threats_found = []
                for ioc in ioc_list:
                    is_threat = self.check_threat_status(ioc, ioc_type)
                    if is_threat:
                        threats_found.append({
                            'ioc': ioc,
                            'type': ioc_type,
                            'threat_level': 'high',
                            'confidence': 0.8
                        })
                
                if threats_found:
                    threat_analysis[ioc_type] = threats_found
            
            return {
                'status': 'success',
                'iocs_extracted': iocs,
                'threats_identified': threat_analysis,
                'total_iocs': sum(len(v) for v in iocs.values()),
                'total_threats': sum(len(v) for v in threat_analysis.values())
            }
            
        except Exception as e:
            logger.error(f"IOC extraction failed: {str(e)}")
            return {'error': str(e)}
    
    def check_threat_status(self, ioc: str, ioc_type: str) -> bool:
        """Check if IOC is a known threat"""
        threat_lists = {
            'ip': self.known_threats.get('ips', []),
            'domain': self.known_threats.get('domains', []),
            'hash_md5': self.known_threats.get('hashes', []),
            'hash_sha1': self.known_threats.get('hashes', []),
            'hash_sha256': self.known_threats.get('hashes', [])
        }
        
        return ioc in threat_lists.get(ioc_type, [])


def main():
    """Main function for CLI usage"""
    if len(sys.argv) < 2:
        print("Usage: python ml_models.py <command> [args]")
        print("Commands: anomaly_train, anomaly_predict, forecast, nlp_analyze, threat_intel")
        return
    
    command = sys.argv[1]
    
    try:
        # Read input data from stdin
        input_data = json.loads(sys.stdin.read())
        
        if command == 'anomaly_train':
            detector = LogAnomalyDetector()
            result = detector.train(input_data.get('log_entries', []))
            print(json.dumps(result))
        
        elif command == 'anomaly_predict':
            detector = LogAnomalyDetector()
            # In a real implementation, you'd load a trained model
            result = {'error': 'Model not trained. Run anomaly_train first.'}
            print(json.dumps(result))
        
        elif command == 'forecast':
            predictor = LogTimeSeriesPredictor()
            result = predictor.train_prophet(input_data.get('log_entries', []))
            if result.get('status') == 'success':
                forecast_result = predictor.forecast(input_data.get('hours_ahead', 24))
                result.update(forecast_result)
            print(json.dumps(result))
        
        elif command == 'nlp_analyze':
            analyzer = LogNLPAnalyzer()
            messages = [entry.get('message', '') for entry in input_data.get('log_entries', [])]
            result = analyzer.analyze_messages(messages)
            print(json.dumps(result))
        
        elif command == 'threat_intel':
            threat_intel = LogThreatIntelligence()
            result = threat_intel.extract_iocs(input_data.get('log_entries', []))
            print(json.dumps(result))
        
        else:
            print(json.dumps({'error': f'Unknown command: {command}'}))
    
    except Exception as e:
        logger.error(f"Command execution failed: {str(e)}")
        print(json.dumps({'error': str(e)}))


if __name__ == '__main__':
    main()

