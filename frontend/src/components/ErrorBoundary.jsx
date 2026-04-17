import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-md w-full border border-red-100 animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={40} className="text-red-500" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 mb-4">Oops! Something went wrong.</h1>
            <p className="text-gray-500 mb-8 font-medium">
              We encountered an unexpected error. Don't worry, your ride data is safe—just refresh to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-black text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-gray-800 transition-all shadow-xl shadow-black/10"
            >
              <RefreshCw size={20} />
              Reload App
            </button>
            <p className="mt-6 text-[10px] text-gray-300 uppercase tracking-widest font-black">
              Error: {this.state.error?.message || 'Unknown Runtime Error'}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
