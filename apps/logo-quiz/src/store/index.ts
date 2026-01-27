import { combineReducers } from 'redux';
import { logoReducer } from './logo';
import { systemReducer } from './system/reducers';
import { levelReducer } from './level';
import { levelsReducer } from './levels';
import { authReducer } from './auth/reducers';
import { gameRoomReducer } from './gameRoom';

const appReducer = combineReducers({
  logo: logoReducer,
  level: levelReducer,
  levels: levelsReducer,
  system: systemReducer,
  auth: authReducer,
  gameRoom: gameRoomReducer,
});

export const rootReducer = (state: any, action: any) => {
  if (action.type === 'LOGOUT') localStorage.removeItem('jwt');
  return appReducer(state, action);
};

export type AppState = ReturnType<typeof rootReducer>;
export * from './logo';
export * from './level';
export * from './levels';
export * from './auth';
export * from './gameRoom';
