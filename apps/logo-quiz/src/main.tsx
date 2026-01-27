import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import './styles.scss';
import { App } from './app/app';
import LevelList from './app/views/LevelList/LevelList';
import LogoVerify from './app/views/LogoVerify/LogoVerify';
import LogoList from './app/views/LogoList/LogoList';
import LogOut from './app/views/LogOut/LogOut';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, applyMiddleware } from 'redux';
import { rootReducer } from './store';
import { thunk } from 'redux-thunk';
import Login from './app/views/Login/Login';
import './shared/api/http-interceptor';
import SignUp from './app/views/SignUp/SignUp';
import { FirebaseContext } from './shared/components/firebase/with-firebase';
import { Firebase } from './shared/components/firebase/firebase';
import { ROUTES } from './shared/utils/routes';
import { ErrorBoundary } from './shared/components/error-boundary/error-boundary';
import BattleMenu from './app/views/Battle/BattleMenu';
import CreateRoom from './app/views/Battle/CreateRoom/CreateRoom';
import JoinRoom from './app/views/Battle/JoinRoom/JoinRoom';
import GameLobby from './app/views/Battle/GameLobby/GameLobby';
import BattleGame from './app/views/Battle/BattleGame/BattleGame';
import Scoreboard from './app/views/Battle/Scoreboard/Scoreboard';

const store = createStore(
  rootReducer,
  applyMiddleware(thunk),
);

const container = document.querySelector('logo-quiz-root');
const root = createRoot(container!);

root.render(
  <ErrorBoundary>
    <FirebaseContext.Provider value={new Firebase()}>
      <Provider store={store}>
        <Router>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path={ROUTES.LOGOS_INDIVIDUAL} element={<LogoVerify />} />
            <Route path={ROUTES.LEVELS_INDIVIDUAL} element={<LogoList />} />
            <Route path={ROUTES.LEVELS_LIST} element={<LevelList />} />
            <Route path={ROUTES.LOGIN} element={<Login />} />
            <Route path={ROUTES.LOGOUT} element={<LogOut />} />
            <Route path={ROUTES.SIGNUP} element={<SignUp />} />
            <Route path={ROUTES.BATTLE} element={<BattleMenu />} />
            <Route path={ROUTES.BATTLE_CREATE} element={<CreateRoom />} />
            <Route path={ROUTES.BATTLE_JOIN} element={<JoinRoom />} />
            <Route path={ROUTES.BATTLE_LOBBY} element={<GameLobby />} />
            <Route path={ROUTES.BATTLE_GAME} element={<BattleGame />} />
            <Route path={ROUTES.BATTLE_SCOREBOARD} element={<Scoreboard />} />
          </Routes>
        </Router>
      </Provider>
    </FirebaseContext.Provider>
  </ErrorBoundary>
);
