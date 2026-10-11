// SPDX-License-Identifier: MPL-2.0
import React from 'react';
import {startupStage} from './startup.mjs';
export class ReportBoundary extends React.Component{
 state={error:false};
 static getDerivedStateFromError(){return {error:true};}
 componentDidCatch(){startupStage('REACT_RENDER_FAILED','REACT_BOUNDARY');}
 render(){
  if(!this.state.error)return this.props.children;
  return <section className="card empty-state" role="alert" data-report-failed="true"><strong>Report unavailable</strong><p>This report could not be displayed. Extremely large values may exceed chart limits. Your saved records have not changed.</p><button onClick={()=>this.setState({error:false})}>Retry report</button></section>;
 }
}
