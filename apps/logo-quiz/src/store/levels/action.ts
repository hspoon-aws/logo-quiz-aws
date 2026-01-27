import { Level } from '@logo-quiz/models';
import {
  LevelsActionTypes,
  REQUEST_LEVELS,
  REQUEST_LEVELS_SUCCESS,
  FLUSH_LEVELS,
  REQUEST_LEVELS_ERROR
} from './types';
import { Dispatch } from 'redux';
// TODO the imported function 'fetchLevels' conflicts with this class' function 'fetchLevels'.
// We'll need to come up with better naming, or expose the service methods in a namespace 'LevelService'.
import { fetchLevels as apiFetchLevels } from '../../shared/services';
import { getCompletedLogos } from '../../shared/helpers/completed-logos';

export function requestLevels(): LevelsActionTypes {
  return {
    type: REQUEST_LEVELS
  };
}

export function requestLevelsSuccess(levels: Level[]): LevelsActionTypes {
  return {
    type: REQUEST_LEVELS_SUCCESS,
    levels
  };
}

export function requestLevelsError(error): LevelsActionTypes {
  return {
    type: REQUEST_LEVELS_ERROR,
    error
  };
}

export function flushLevels(): LevelsActionTypes {
  return {
    type: FLUSH_LEVELS
  };
}

export function fetchLevels() {
  return function(dispatch: Dispatch) {
    dispatch(requestLevels());
    return apiFetchLevels()
      .then(levels => {
        // Mark logos as validated based on localStorage for anonymous users
        const completedLogos = getCompletedLogos();
        const levelsWithValidation = levels.map(level => ({
          ...level,
          logos: level.logos.map(logo => ({
            ...logo,
            validated: completedLogos.includes(logo.logoId)
          }))
        }));
        dispatch(requestLevelsSuccess(levelsWithValidation));
      })
      .catch(error => {
        dispatch(requestLevelsError(error));
      });
  };
}
