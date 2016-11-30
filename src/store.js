/**
 * @module react-cmf/lib/store
 */
import { hashHistory } from 'react-router';
import { routerReducer, routerMiddleware } from 'react-router-redux';
import { combineReducers, createStore, applyMiddleware, compose } from 'redux';
import { enableBatching } from 'redux-batched-actions';
import thunk from 'redux-thunk';
import invariant from 'invariant';

import cmfReducers from './reducers';

const enhancers = [];
const middlewares = [thunk];
if (window) {
	if (window.devToolsExtension) {
		enhancers.push(window.devToolsExtension());
	}
}

// Indicated wether or not the default router was overwritten
let defaultRouterOverwrite = false;

/**
 * setRouterMiddleware overwrites the default router middleware
 *
 * @param middleware a router middleware
 */
function setRouterMiddleware(middleware) {
	middlewares.push(middleware);
	defaultRouterOverwrite = true;
}

/**
 * helper to create the store with all the things needed by CMF
 * the store look like this:
 * - root
 * |- app (with appReducer)
 * |- routing (for react-router)
 * |- cmf (for the internals)
 *
 * @param  {function} appReducer   the reducer for your app.
 * @param  {any} preloadedState if you want to create your state tree with initial values.
 *                              This is usefull for server side renderring
 * @param  {function} enhancer     The store enhancer
 * @param  {Array|function} middleware   redux middleware: http://redux.js.org/docs/api/applyMiddleware.html
 * @return {Object}              The created store
 */
function initialize(appReducer, preloadedState, enhancer, middleware) {
	let reducerObject = {};
	if (appReducer) {
		if (typeof appReducer === 'object') {
			reducerObject = Object.assign({}, appReducer);
		} else if (typeof appReducer === 'function') {
			reducerObject = { app: appReducer };
		}
	} else {
		invariant(true, 'Are you sure you want to bootstrap an app without reducers ?');
	}
	if (!reducerObject.cmf) {
		reducerObject.cmf = cmfReducers;
	}
	if (!reducerObject.routing) {
		reducerObject.routing = routerReducer;
	}
	const rootReducer = combineReducers(reducerObject);
	if (Array.isArray(middleware)) {
		middleware.forEach((mid) => {
			if (middlewares.indexOf(mid) === -1) {
				middlewares.push(mid);
			}
		});
	} else if (middleware) {
		middlewares.push(middleware);
	}
	if (typeof enhancer === 'function') {
		enhancers.push(enhancer);
	}
	if (!defaultRouterOverwrite) {
		setRouterMiddleware(routerMiddleware(hashHistory));
	}

	const store = compose(
		applyMiddleware(...middlewares),
		...enhancers
	)(createStore)(enableBatching(rootReducer), preloadedState);

	return store;
}

export default {
	setRouterMiddleware,
	initialize,
};
