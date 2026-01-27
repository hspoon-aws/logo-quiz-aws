import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAnalytics, Analytics } from 'firebase/analytics';
import { environment } from '@logo-quiz/environment';

export class Firebase {
  app: FirebaseApp;
  analytics: Analytics;

  constructor() {
    this.app = initializeApp(environment.firebase);
    this.analytics = getAnalytics(this.app);
  }
}
