// SPDX-License-Identifier: MPL-2.0
import React from 'react';
import {productIdentity} from '../product-identity.mjs';

export function ProductBrand({compact=false}: {compact?:boolean}) {
 return <span className={'brand product-brand'+(compact?' product-brand-compact':'')}>
  <img className="product-symbol" src={productIdentity.icon} alt="" width="44" height="44"/>
  <span className="product-brand-copy"><span className="product-name">{productIdentity.name}</span>
   <span className="product-attribution">by {productIdentity.publisher}</span></span>
 </span>;
}

export function AboutProduct() {
 return <div className="product-about">
  <div><ProductBrand/><p className="settings-intro">A clear view of your money, today and over time.</p>
   <p className="compact-note">Accounts, spending, cash flow and budgets in one place. Your financial records stay in your local database, with manual entry and CSV import.</p>
   <small className="product-version">Version {productIdentity.version}</small></div>
  <div className="publisher-identity"><span className="publisher-caption">Published by</span>
   <div className="publisher-lockup">
    <img className="publisher-logo publisher-logo-light" src={productIdentity.publisherLogos.light} alt={productIdentity.publisher} width="116" height="28"/>
    <img className="publisher-logo publisher-logo-dark" src={productIdentity.publisherLogos.dark} alt={productIdentity.publisher} width="116" height="28"/>
   </div>
  </div>
 </div>;
}
