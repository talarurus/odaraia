// SPDX-License-Identifier: MPL-2.0
import React from 'react';
import {startupStage} from './startup.mjs';
export class ApplicationBoundary extends React.Component {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){startupStage('REACT_RENDER_FAILED','REACT_BOUNDARY');}
 render(){return this.state.failed?<main role="alert"><h1>Odaraia could not display the workspace</h1><p>Your saved records have not been changed. Reload the application or quit and reopen it.</p><button onClick={()=>location.reload()}>Reload workspace</button></main>:this.props.children;}
}
