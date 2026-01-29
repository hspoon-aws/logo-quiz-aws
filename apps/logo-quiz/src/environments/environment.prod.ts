import { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  apiUrl: 'https://hxhjbyvimw.us-east-1.awsapprunner.com/api',
  webSocketUrl: 'wss://ehv67k1and.execute-api.us-east-1.amazonaws.com/prod',
  firebase: {
    apiKey: 'AIzaSyByGkdd0Nly2t4vZP0HJ9EuriXnqmWTeaA',
    authDomain: 'logo-quiz-prod.firebaseapp.com',
    databaseURL: 'https://logo-quiz-prod.firebaseio.com',
    projectId: 'logo-quiz-prod',
    storageBucket: 'logo-quiz-prod.appspot.com',
    messagingSenderId: '653537369067',
    appId: '1:653537369067:web:7063dba90f49536558d7ae',
    measurementId: 'G-6MHFM5RFBW',
  },
};

export default environment;
