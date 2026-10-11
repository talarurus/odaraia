// SPDX-License-Identifier: MPL-2.0
import React from 'react';
export class ReportBoundary extends React.Component{
 state={error:false};
 static getDerivedStateFromError(){return {error:true};}
 render(){
  if(!this.state.error)return this.props.children;
  return <section className="card empty-state" role="alert"><strong>Report unavailable</strong><p>This synthetic report could not be displayed. Choose another demo or retry. No record was changed.</p><button onClick={this.props.onDemo}>Choose demo data</button><button onClick={()=>this.setState({error:false})}>Retry report</button></section>;
 }
}
