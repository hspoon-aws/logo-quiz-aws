import * as React from 'react';
import { Link } from 'react-router-dom';
import SVGBackArrow from '../../icons/back-arrow';
import './BattleMenu.scss';

const BattleMenu: React.FC = () => {
  return (
    <div className="battle-menu container">
      <div className="header-wrapper">
        <Link to="/" className="header-back">
          <SVGBackArrow height="24px" />
        </Link>
        <h3 className="header-title">Battle Mode</h3>
      </div>

      <div className="battle-menu__wrapper">
        <div className="battle-menu__content">
          <h2 className="battle-menu__title">Multiplayer Battle</h2>
          <p className="battle-menu__description">
            Compete with friends to guess logos in real-time!
            First to answer correctly gets bonus points.
          </p>

          <div className="battle-menu__buttons">
            <Link to="/battle/create" className="battle-menu__button">
              Create Room
            </Link>
            <Link to="/battle/join" className="battle-menu__button battle-menu__button--secondary">
              Join Room
            </Link>
          </div>

          <div className="battle-menu__info">
            <h4>How it works:</h4>
            <ul>
              <li>Create a room and share the 6-character code</li>
              <li>Wait for players to join and ready up</li>
              <li>Race to guess the logos - first correct answer advances everyone</li>
              <li>Speed bonus points for faster answers!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BattleMenu;
