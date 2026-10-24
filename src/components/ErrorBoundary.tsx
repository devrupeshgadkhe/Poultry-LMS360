import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log the error to the developer's server logger
    const message = `React UI Crash: ${error.message || String(error)}`;
    const stack = `${error.stack || ''}\n\nComponent Stack:\n${errorInfo.componentStack || ''}`;
    
    fetch('/api/errors/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'Client',
        message,
        stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        userEmail: localStorage.getItem('userEmail') || 'Anonymous'
      })
    }).catch(err => {
      console.warn('Failed to dispatch React crash trace to log API:', err);
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    localStorage.removeItem('poultry_sidebar_collapsed');
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 selection:bg-rose-500 selection:text-white" id="app-crash-screen">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-8 space-y-6 shadow-xl relative overflow-hidden">
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl"></div>
            
            <div className="flex items-center gap-4 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                <AlertTriangle className="h-8 w-8 animate-bounce" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight">
                  Application Notice
                </h1>
                <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                  An unexpected error occurred while displaying the page.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-950 text-slate-200 border border-slate-800 rounded-2xl font-mono text-[11px] space-y-2 overflow-auto max-h-[220px]">
              <div className="text-rose-400 font-bold">
                Error Details: {this.state.error?.message || 'Unknown system error'}
              </div>
              {this.state.error?.stack && (
                <pre className="text-slate-400 leading-relaxed whitespace-pre-wrap font-mono">
                  {this.state.error.stack}
                </pre>
              )}
            </div>

            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800 text-[11px] leading-relaxed flex gap-2">
              <span className="font-bold shrink-0">SYSTEM NOTICE:</span>
              <span>
                This error has been logged automatically to the system audit trail. Please reload the application or contact support if the issue persists.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold font-mono tracking-wide shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                Reload Web Applet
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 py-3 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer"
              >
                <Home className="h-4 w-4" />
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
