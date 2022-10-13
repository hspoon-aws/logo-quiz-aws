import * as React from 'react';
import { Component } from 'react';

import './app.scss';
import { Link } from 'react-router-dom';

export class App extends Component {
  render() {
    return (
      <div className="vh-center main">
        <div className="vh-center flex-column main__content">
          <h1 className="main__header">Logo Quiz</h1>
          <h2 className="main__subheader">AWS Edition</h2>
          <img
            className="main__image"
            src="https://d0.awsstatic.com/logos/powered-by-aws-white.png"
            alt="logos"
          />
          <Link className="main__button vh-center" to="/levels">
            Play
          </Link>
          
          <div className="main__footer">This project is forked from <br/> <a href="https://github.com/logo-quiz/logo-quiz">Logo-quiz Github</a></div>
        </div>
        
      </div>
    );
  }
}
