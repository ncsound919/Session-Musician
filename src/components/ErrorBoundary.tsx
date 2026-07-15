/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const error = this.state.error;
      return (
        <div className="min-h-screen bg-studio-bg flex items-center justify-center p-4">
          <div className="bg-studio-card border border-red-500/30 p-8 rounded-3xl max-w-md w-full text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">System Malfunction</h2>
              <p className="text-studio-muted text-sm font-mono leading-relaxed">
                The neural audio engine encountered an unrecoverable state error. 
                {error && <span className="block mt-2 text-red-400/80">Code: {error.message}</span>}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-studio-accent hover:bg-studio-accent-light text-white rounded-xl font-mono uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-studio-accent/20"
            >
              <RefreshCcw className="w-4 h-4" /> Reboot Interface
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
