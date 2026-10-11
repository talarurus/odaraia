// SPDX-License-Identifier: MPL-2.0
import React, { useState, useMemo, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ResponsiveContainer, Sankey, Tooltip, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { palette } from "../shared/fixture.mjs";
import { report, checkedChartNumber } from "../shared/finance.mjs";
import { readPreference, resolveTheme, observeAppearance } from "../shared/appearance.mjs";
import { flowLabelLayout } from "./flow-labels.mjs";
import { demos } from "./scenarios.mjs";
import { initialTxFilters, withStatus, filteredTransactions, flowPresentation, flowDrill, flowHighlighted, periodState, netWorthHistory, readPresentation, savePresentation, transactionsCSV, reducedMotion } from "./ui-model.mjs";
import { PresentationContext, usePresentation, useMoney, usePercentage, Empty, HiddenChart, FinanceTooltip } from "./presentation.jsx";
import { ReportBoundary } from "./report-boundary.jsx";
import "./style.css";
const pages = [["transactions", "Transactions", "list"], ["cashflow", "Cash flow", "flow"], ["spending", "Spending", "pie"], ["networth", "Net worth", "trend"]];
const color = (name) => `var(--color-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}, ${palette[name] || "#8a948d"})`;
function Icon({ name, size = 16 }) {
  const paths = { list: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>, flow: <><path d="M7 3v18M17 21V3M3 7l4-4 4 4M13 17l4 4 4-4" /></>, pie: <><path d="M12 3v9h9A9 9 0 0 0 12 3Z" /><path d="M8 4A9 9 0 1 0 20 16" /></>, trend: <path d="m3 17 6-6 4 3 8-9M16 5h5v5" />, home: <><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8" /></>, more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>, search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>, left: <path d="m14 6-6 6 6 6" />, right: <path d="m10 6 6 6-6 6" />, calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>, filter: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="10" cy="18" r="2" /></>, close: <path d="m6 6 12 12M18 6 6 18" />, plus: <path d="M12 4v16M4 12h16" />, shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>, settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="8" /></>, download: <><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" /></> };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.home}</svg>;
}
function Brand({ compact = false }) {
  return <span className="brand"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 17 12 5l7 12Z" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M8 17h8" stroke="currentColor" strokeWidth="2" /></svg></span>{!compact && <span>Talarurus <span className="brand-finance">Finance</span></span>}</span>;
}
function Segments({ options, value, onChange, label }) {
  return <div className="segments" role="group" aria-label={label}>{options.map(([id, name]) => <button key={id} aria-pressed={id === value} className={id === value ? "selected" : ""} onClick={() => onChange(id)}>{name}</button>)}</div>;
}
function Dot({ name }) {
  return <span className="dot" style={{ background: color(name) }} />;
}
function Card({ title, children, tools, className = "" }) {
  return <section className={`card ${className}`}><div className="card-heading"><h2>{title}</h2>{tools}</div>{children}</section>;
}
function Ranked({ rows, total, onSelect, caption = "Category", denominator = "spending" }) {
  const money = useMoney(), percent = usePercentage(), preferences = usePresentation();
  const max = rows.reduce((m, x) => Math.max(m, checkedChartNumber(x.value)), 1);
  return <div className="ranked" aria-label={`${caption} breakdown`}><p className="breakdown-denominator">% of {denominator} · net of refunds and adjustments</p>{rows.length === 0 ? <p className="compact-note">No posted {caption.toLowerCase()} activity.</p> : rows.map((x) => <button className="rank-row" key={x.name} onClick={() => onSelect(x.name)}><span className="rank-label"><Dot name={x.colorKey || x.name} />{x.name}</span><span className="rank-value">{money(x.value)}<small>{percent(x.value, total, denominator)}</small></span>{!preferences.hidden && <span className="bar-track"><span style={{ width: `${Math.max(0, checkedChartNumber(x.value) / max * 100)}%`, background: color(x.colorKey || x.name) }} /></span>}</button>)}</div>;
}
function Stats({ items }) {
  return <div className="stats">{items.map((x) => <div className="stat card" key={x.label}><span className="stat-label">{x.dot && <Dot name={x.dot} />} {x.label}</span><strong>{x.value}</strong><small>{x.note}</small></div>)}</div>;
}
function DataTable({ caption, rows, onSelect, onSelectRow }) {
  const money = useMoney();
  return <details className="data-disclosure"><summary>View chart data</summary><table><caption>{caption}</caption><thead><tr><th scope="col">Category</th><th scope="col">Amount</th></tr></thead><tbody>{rows.map((x) => <tr key={`${x.kind || "row"}-${x.name}`}><th scope="row"><button onClick={() => onSelectRow ? onSelectRow(x) : onSelect(x.name)}>{x.label || x.name}</button></th><td>{money(x.value)}</td></tr>)}</tbody></table></details>;
}
function FlowNode({ x, y, width, height, index, payload, select, inspect, layout, centerLabel, active, money, percent }) {
  const left = ["income", "deficit", "credit"].includes(payload.kind), center = payload.kind === "center";
  const labelY = left ? y + height / 2 : center ? y - 13 : layout.labelY(index);
  const labelX = left ? x - 10 : center ? x + width / 2 : x + width + 18;
  const name = center ? centerLabel : payload.name, activate = () => select(payload);
  return <g className={`flow-node ${active === payload.name ? "is-active" : ""}`}><rect x={x} y={y} width={width} height={height} fill={center ? "var(--income-chart)" : color(payload.name)} rx="1" />{!left && !center && <path className="flow-label-leader" d={`M${x + width},${y + height / 2} L${x + width + 9},${y + height / 2} L${labelX - 4},${labelY}`} fill="none" />}<g className="flow-label" data-kind={payload.kind} role="button" tabIndex="0" aria-label={`${name} ${money(payload.value)}; ${percent(payload.value)}; view transactions`} onMouseEnter={() => inspect(payload.name)} onMouseLeave={() => inspect(null)} onFocus={() => inspect(payload.name)} onBlur={() => inspect(null)} onClick={activate} onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  }}><text x={labelX} y={labelY - 3} textAnchor={left ? "end" : center ? "middle" : "start"} fill="var(--text)" fontSize="12" fontWeight="500">{name}</text><text x={labelX} y={labelY + 12} textAnchor={left ? "end" : center ? "middle" : "start"} fill="var(--muted)" fontSize="12">{money(payload.value)}</text></g></g>;
}
function FlowLink({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload, active, setActive, select, money, percent, data }) {
  const name = payload.name, highlighted = flowHighlighted(active, payload, data);
  const description = `${name}: ${money(Math.round(payload.value))}; ${percent(Math.round(payload.value))}; view transactions`;
  return <path className="flow-link" role="button" tabIndex="0" aria-label={description} d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`} stroke={color(name)} fill="none" strokeOpacity={highlighted ? 0.68 : active ? 0.16 : 0.32} strokeWidth={linkWidth} onMouseEnter={() => setActive(name)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(name)} onBlur={() => setActive(null)} onClick={() => select(payload)} onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(payload);
    }
  }}><title>{description}</title></path>;
}
function CashFlow({ r, onDrill, fixture, filters, onDemo }) {
  const [view, setView] = useState("profit"), [active, setActive] = useState(null), [lastInspected, setLastInspected] = useState(null);
  const inspect = (name) => { setActive(name); if (name) setLastInspected(name); };
  const money = useMoney(), percentage = usePercentage(), preferences = usePresentation();
  const data = useMemo(() => flowPresentation(r), [r]), layout = flowLabelLayout(data), state = periodState(fixture, filters, r);
  const percent = (value) => percentage(value, r.income, "income");
  const compactPercent = (value) => preferences.hidden ? "\u2022\u2022\u2022\u2022" : BigInt(r.income) > 0n ? percent(value).replace(" of income", "") : "\u2014";
  const drill = (node) => onDrill(flowDrill(typeof node === "string" ? data.nodes.find((n) => n.name === node) || { kind: "center" } : node));
  const inspected = data.nodes.find((n) => n.name === lastInspected);
  const sankey = <div className="sankey-plot" style={{ height: layout.height }} aria-label="Cash flow Sankey diagram"><ResponsiveContainer width="100%" height="100%"><Sankey data={data} nodePadding={24} nodeWidth={5} margin={{ top: 44, right: 230, bottom: 26, left: 160 }} iterations={64} sort={false} node={<FlowNode select={drill} inspect={inspect} layout={layout} centerLabel={data.centerLabel} active={active} money={money} percent={percent} />} link={<FlowLink active={active} setActive={inspect} select={drill} money={money} percent={percent} data={data} />} /></ResponsiveContainer></div>;
  const profit = <div className="profit-loss"><div className="profit-columns"><span>Category</span><span>% of income</span><span>Amount</span></div><div className="profit-total"><strong>Income</strong><b>{money(r.income)}</b></div>{r.incomes.map((x) => <button className="profit-row" key={x.name} onClick={() => onDrill({ category: x.name, classification: "income" })}><span><Dot name={x.colorKey || x.name} />{x.name}</span><small>{compactPercent(x.value)}</small><b>{money(x.value)}</b></button>)}<div className="profit-total"><strong>Expenses</strong><b>{money(-BigInt(r.spending))}</b></div>{r.expenses.map((x) => <button className="profit-row" key={x.name} onClick={() => onDrill({ category: x.name, classification: "expense" })}><span><Dot name={x.colorKey || x.name} />{x.name}</span><small>{compactPercent(x.value)}</small><b>{money(-BigInt(x.value))}</b></button>)}<div className={`profit-total ${BigInt(r.surplus) < 0n ? "deficit" : "surplus"}`}><strong>{BigInt(r.surplus) < 0n ? "Net deficit" : "Net surplus"}</strong><b>{money(r.surplus)}</b></div><p className="compact-note">Savings transfers move money between your accounts.</p></div>;
  return <><Card title="Where the money went" className="cashflow-main" tools={<div className="cash-tools"><span className="desktop-only compact-note">Categories · % of income</span><span className="mobile-only"><Segments label="Cash flow view" options={[["profit", "Profit & loss"], ["sankey", "Sankey"]]} value={view} onChange={setView} /></span></div>}>
 {state ? <Empty {...state} onDemo={onDemo} /> : preferences.hidden ? <HiddenChart /> : data.links.length === 0 ? <Empty title="No net cash flow to chart" note="Posted adjustments cancel out. The exact category data remains available below." /> : <><div className="desktop-only sankey-scroll" role="region" tabIndex="0" aria-label="Cash flow chart; scroll horizontally if needed">{sankey}</div><div className="mobile-only">{view === "sankey" ? <><div className="mobile-chart-note">Swipe inside the diagram for the full view.</div><div className="mobile-sankey-scroll" role="region" tabIndex="0" aria-label="Cash flow chart; scroll horizontally">{sankey}</div></> : profit}</div><div className={`flow-inspector ${view === "profit" ? "inspector-desktop-only" : ""}`} aria-live="polite">{inspected ? <><strong>{inspected.kind === "center" ? data.centerLabel : inspected.name}</strong><span>{money(inspected.value)} · {percent(inspected.value)}</span><button onFocus={() => setActive(inspected.name)} onBlur={() => setActive(null)} onClick={() => drill(inspected)}>View transactions</button><button onClick={() => { setLastInspected(null); setActive(null); }}>Clear selection</button></> : <span>Hover or focus a flow to inspect it. Select a label to view transactions.</span>}</div></>}
 {!state && <DataTable caption="Posted cash flow — transfers excluded; refunds reduce expenses" rows={[...r.incomes.map((x) => ({ ...x, kind: "income", label: `${x.name} \xB7 Income` })), ...r.expenses.map((x) => ({ ...x, kind: "expense", label: `${x.name} \xB7 Expense` })), { name: BigInt(r.surplus) < 0n ? "Net deficit" : "Net surplus", value: r.surplus, kind: "center" }]} onSelectRow={(node) => onDrill(flowDrill(node))} />}
 <p className="compact-note">{data.note} {BigInt(r.income) <= 0n ? "% of income is unavailable without positive net income." : ""} {!state && r.incomes.length === 0 ? "No posted income this period." : ""}</p></Card>
 {!state && <div className="two-column cash-lists"><Card title="Income"><Ranked rows={r.incomes} total={r.income} denominator="income" onSelect={(name) => onDrill({ category: name, classification: "income" })} /></Card><Card title="Expenses"><Ranked rows={r.expenses} total={r.income} denominator="income" onSelect={(name) => onDrill({ category: name, classification: "expense" })} /></Card></div>}
 {!state && <p className="report-note">{BigInt(r.surplus) < 0n ? "Net deficit" : "Net surplus"} {money(r.surplus)} · Internal deposits to savings {money(r.transferDeposits)} · Pending transactions excluded</p>}</>;
}
function Spending({ r, fixture, filters, onDrill, onDemo, group, setGroup }) {
  const [hover, setHover] = useState(null);
  const money = useMoney(), percent = usePercentage(), preferences = usePresentation();
  const rows = (group === "merchants" ? r.merchants : r.expenses).map((x) => ({ ...x, colorKey: group === "merchants" ? fixture.transactions.find((t) => t.payee === x.name && t.classification === "expense")?.category || x.name : x.name })), positive = rows.filter((x) => BigInt(x.value) > 0n), largest = r.expenses.find((x) => BigInt(x.value) > 0n);
  const months = filters.start === "2026-07-01" && filters.end === "2026-10-01" ? 3 : 1, state = periodState(fixture, filters, r);
  const trend = ["07", "08", "09"].filter((m) => `2026-${m}-01` >= filters.start && `2026-${m}-01` < filters.end).map((m) => ({ month: { "07": "Jul", "08": "Aug", "09": "Sep" }[m], value: checkedChartNumber(report(fixture.accounts, fixture.transactions, { start: `2026-${m}-01`, end: `2026-${String(Number(m) + 1).padStart(2, "0")}-01` }).spending) / 100 }));
  const drill = (name) => onDrill({ ...group === "merchants" ? { merchant: name } : { category: name }, classification: "expense" });
  return <><Stats items={[{ label: "Total spending", value: fixture.accounts.length ? money(r.spending) : "No accounts", dot: "Transport", note: "After refunds \xB7 posted only" }, { label: "Average per month", value: fixture.accounts.length ? money(BigInt(r.spending) / BigInt(months)) : "No accounts", note: `${months} ${months === 1 ? "month" : "months"} in this period` }, { label: "Largest category", value: largest?.name || "No activity", note: largest ? percent(largest.value, r.spending, "spending") : "" }, { label: "Transactions", value: r.expenseCount, note: "Includes posted refunds" }]} />
 <Card title="Spending breakdown" tools={<Segments label="Spending grouping" options={[["categories", "Categories"], ["merchants", "Merchants"]]} value={group} onChange={(value) => {
    setGroup(value);
    setHover(null);
  }} />}>
 {state ? <Empty {...state} onDemo={onDemo} /> : r.expenseCount === 0 ? <Empty title="No spending this period" note="Posted income is available in Cash flow. Choose another period or demo to see spending." onDemo={onDemo} /> : <><p className="compact-note">% of spending uses net posted spending after refunds. Cash flow uses % of income.</p><div className="spending-breakdown"><div className="donut-block">{preferences.hidden ? <HiddenChart /> : BigInt(r.spending) <= 0n ? <Empty title="Net credits this period" note="Refunds meet or exceed charges. Net category amounts appear in the list; % of spending is unavailable." /> : <><div className="donut-plot" aria-label={`Spending by ${group}`}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={positive.map((x) => ({ ...x, chart: checkedChartNumber(x.value) }))} dataKey="chart" innerRadius="66%" outerRadius="91%" paddingAngle={1} stroke="var(--surface)" strokeWidth={1} isAnimationActive={false} onMouseEnter={(x) => setHover(x.name)} onMouseLeave={() => setHover(null)} onClick={(x) => drill(x.name)}>{positive.map((x) => <Cell key={x.name} fill={color(x.colorKey || x.name)} fillOpacity={hover && hover !== x.name ? 0.45 : 1} />)}</Pie><Tooltip content={<FinanceTooltip total={r.spending} denominator="spending" />} /></PieChart></ResponsiveContainer><div className="donut-center"><span>Net spending</span><strong>{money(r.spending, { whole: true })}</strong></div></div><div className="legend">{positive.map((x) => <button key={x.name} onMouseEnter={() => setHover(x.name)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(x.name)} onBlur={() => setHover(null)} onClick={() => drill(x.name)} aria-label={`${x.name}; ${money(x.value)}; ${percent(x.value, r.spending, "spending")}; view transactions`}><Dot name={x.colorKey || x.name} />{x.name}</button>)}</div>{rows.some((x) => BigInt(x.value) < 0n) && <p className="compact-note">Donut segments show positive categories only. Credits are listed separately; shares of net spending can exceed 100%.</p>}</>}</div><Ranked rows={rows} total={r.spending} onSelect={drill} caption={group === "merchants" ? "Merchant" : "Category"} /></div><DataTable caption={`Net spending by ${group}`} rows={rows} onSelect={drill} /></>}
 </Card>{!state && r.expenseCount > 0 && <Card title="Spending trend" className="trend-card"><p className="compact-note">Monthly net spending in the selected period, after refunds.</p>{preferences.hidden ? <HiddenChart /> : <div className="trend-plot"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{ left: 0, right: 18, top: 16, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--line)" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted)" }} /><YAxis tickLine={false} axisLine={false} width={preferences.format === "code" ? 85 : 65} tickFormatter={(v) => money(Math.round(v * 100), { whole: true })} tick={{ fontSize: 12, fill: "var(--muted)" }} /><Tooltip content={<FinanceTooltip />} /><Line type="linear" dataKey="value" name="Spending" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>}</Card>}</>;
}
function Transactions({ fixture, period, filters, setFilters, onDetail, onFilterSheet, onDemo, onReturn, origin }) {
  const money = useMoney(), preferences = usePresentation();
  const rows = filteredTransactions(fixture, period, filters, preferences);
  const grouped = Object.entries(Object.groupBy(rows, (r) => r.date));
  const accountName = (id) => fixture.accounts.find((a) => a.id === id)?.name || id;
  const incoming = rows.filter((x) => x.status === "posted" && BigInt(x.amount) > 0n).reduce((s, x) => s + BigInt(x.amount), 0n), outgoing = rows.filter((x) => x.status === "posted" && BigInt(x.amount) < 0n).reduce((s, x) => s - BigInt(x.amount), 0n);
  const dateLabel = (d) => (/* @__PURE__ */ new Date(d + "T12:00:00Z")).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const active = Object.entries(filters).filter(([k, v]) => v && !(k === "status" && v === "all")).length;
  return <section className="card transaction-card">{origin && <div className="drill-context"><span>From {origin} · {filters.status === "all" ? "all statuses" : filters.status} · {filters.classification || filters.kind || "all types"}{filters.category && ` \xB7 ${filters.category}`}{filters.merchant && ` \xB7 ${filters.merchant}`}{filters.account && ` \xB7 ${accountName(filters.account)}`}</span><button onClick={onReturn}>Back to {origin}</button></div>}<div className="transaction-search"><label className="search-input"><Icon name="search" /><input aria-label="Search transactions" placeholder={preferences.hidden ? "Search merchant or category" : "Search merchant, category or amount"} value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></label><button className="mobile-only square-button" aria-label="Transaction filters" onClick={onFilterSheet}><Icon name="filter" /></button><button aria-label="Add transaction (prototype only)" className="orange-button" onClick={() => onDetail({ prototypeAction: true })}><span className="desktop-only">Add · demo only</span><span className="mobile-only"><Icon name="plus" /></span></button></div><div className="transaction-controls"><Segments label="Transaction status" options={[["all", "All"], ["review", "Needs review"], ["pending", "Pending"], ["posted", "Posted"]]} value={filters.status} onChange={(status) => setFilters(withStatus(filters, status))} /><div className="desktop-only inline-filters"><label><span className="sr-only">Filter account</span><select aria-label="Filter account" value={filters.account} onChange={(e) => setFilters({ ...filters, account: e.target.value })}><option value="">All accounts</option>{fixture.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label><span className="sr-only">Filter category</span><select aria-label="Filter category" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{[...new Set(fixture.transactions.map((r) => r.category))].sort().map((c) => <option key={c}>{c}</option>)}</select></label></div>{active > 0 && <button className="clear-filter" onClick={() => setFilters(initialTxFilters)}>Clear filters ({active})</button>}</div><p className="transaction-summary" aria-live="polite"><span data-testid="transaction-count">{rows.length} transactions</span> · <span className="amount-green">{money(incoming)} in</span> · {money(outgoing)} out <span className="summary-caveat">· includes account transfers; posted totals</span></p><table className="transaction-table desktop-only"><caption className="sr-only">Transactions grouped by date; pending is excluded from report totals</caption><thead><tr><th scope="col" className="check-cell">Select</th><th scope="col">Merchant</th><th scope="col">Category</th><th scope="col">Account</th><th scope="col" className="amount-cell">Amount</th></tr></thead><tbody>{grouped.map(([date, items]) => <React.Fragment key={date}><tr className="date-row"><th colSpan="5" scope="rowgroup">{dateLabel(date)}</th></tr>{items.map((t) => <tr className={t.status === "pending" ? "pending-row" : ""} key={t.id}><td className="check-cell"><input type="checkbox" disabled title="Bulk selection is outside this prototype" aria-label={`Select ${t.payee} ${t.id}`} /></td><td><button className="merchant-button" onClick={() => onDetail(t)}><span className="merchant-avatar" style={{ background: color(t.category) }}>{t.payee[0]}</span>{t.payee}{t.status === "pending" && <span className="pending-tag">Pending</span>}</button></td><td>{t.category}</td><td className="muted">{accountName(t.account)}</td><td className={`amount-cell ${BigInt(t.amount) > 0n ? "amount-green" : ""}`}>{money(t.amount, { signed: true })}</td></tr>)}</React.Fragment>)}</tbody></table><div className="mobile-only mobile-transactions">{grouped.map(([date, items]) => <section key={date}><h2 className="date-header">{dateLabel(date)}</h2>{items.map((t) => <button key={t.id} className="mobile-tx" onClick={() => onDetail(t)}><span className="tx-left"><span className="tx-merchant"><span className="merchant-avatar" style={{ background: color(t.category) }}>{t.payee[0]}</span>{t.payee}</span><small>{t.category}{t.status === "pending" ? " \xB7 Pending" : ""}</small></span><span className={BigInt(t.amount) > 0n ? "amount-green" : ""}>{money(t.amount, { signed: true })}</span></button>)}</section>)}</div>{rows.length === 0 && (fixture.accounts.length === 0 ? <Empty title="No accounts yet" note="Choose another synthetic demo to explore transactions." onDemo={onDemo} /> : fixture.transactions.length === 0 ? <Empty title="No transactions yet" note="This demo contains opening account balances only." onDemo={onDemo} /> : <div className="empty-state" role="status"><strong>No transactions match these filters.</strong><p>Try another period or clear your search and filters.</p><button onClick={() => setFilters(initialTxFilters)}>Clear filters</button></div>)}<p className="compact-note table-footer">Synthetic records. Select a merchant to inspect why it contributes to reports.</p></section>;
}
function NetWorth({ fixture, filters, r, onDemo }) {
  const money = useMoney(), preferences = usePresentation(), history2 = useMemo(() => netWorthHistory(fixture, filters), [fixture, filters.start, filters.end]);
  const known = fixture.accounts.filter((a) => r.balances[a.id] !== void 0), unknown = fixture.accounts.filter((a) => r.balances[a.id] === void 0);
  return <><Stats items={[{ label: "Net worth", value: fixture.accounts.length ? money(r.netWorth) : "No accounts", note: "Assets minus liabilities \xB7 posted balances" }, { label: "Change this period", value: money(history2.change, { signed: true }), dot: "Net surplus", note: history2.beginning === null ? "Start-of-period balance unavailable" : "From the start of the selected period" }, { label: "Assets", value: fixture.accounts.length ? money(r.assets) : "No accounts", note: "Positive account balances" }, { label: "Liabilities", value: fixture.accounts.length ? money(r.liabilities) : "No accounts", note: "Outstanding account debt" }]} />
 <Card title="Net worth over time"><div className="chart-subline"><span className="selected-pill">Net worth</span><span>All accounts · USD</span></div><p className="compact-note">Opening balances plus posted transactions. Transfers and card payments move balances between accounts; paired entries cancel in net worth. Pending is excluded.</p>
 {history2.reason ? <Empty title={history2.reason} note={fixture.accounts.length ? "Opening balance anchors fall after this period. Choose another demo; unknown balances are not zero." : "Choose a synthetic demo with accounts to explore balance history."} onDemo={onDemo} /> : preferences.hidden ? <HiddenChart /> : <><div className="networth-plot" aria-label="Daily net worth"><ResponsiveContainer width="100%" height="100%"><AreaChart data={history2.days} margin={{ left: 0, right: 18, top: 20, bottom: 0 }}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="date" interval="preserveStartEnd" minTickGap={55} tickFormatter={(v) => (/* @__PURE__ */ new Date(v + "T12:00:00Z")).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted)" }} /><YAxis domain={["auto", "auto"]} width={preferences.format === "code" ? 95 : 78} tickFormatter={(v) => money(Math.round(v * 100), { whole: true })} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted)" }} /><Tooltip content={<FinanceTooltip history />} /><Area dataKey="value" name="Net worth" type="linear" connectNulls={false} fill="var(--chart-fill)" fillOpacity={0.65} stroke="var(--accent)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>
 <p className="compact-note">Daily closing balances; salary deposits cause real jumps. Hover the chart or open history for the posted events.{history2.days.some((d) => d.minor === null) ? " Gaps mean balance history is unavailable." : ""}</p></>}
 {!history2.reason && <details className="data-disclosure"><summary>View balance history</summary><div className="history-scroll" role="region" tabIndex="0" aria-label="Balance history table; scroll horizontally for events"><table><caption>Daily net worth and posted events</caption><thead><tr><th scope="col">Date</th><th scope="col">Net worth</th><th scope="col">Change</th><th scope="col">Events</th></tr></thead><tbody>{history2.days.map((d) => <tr key={d.date}><th scope="row">{d.date}</th><td>{money(d.minor)}</td><td>{money(d.delta, { signed: true })}</td><td>{d.events.join(" \xB7 ") || "No posted transactions"}</td></tr>)}</tbody></table></div></details>}
 {!history2.reason && !preferences.hidden && history2.largest.length > 0 && <details className="data-disclosure"><summary>Why balances jump</summary></details>}
 </Card>
 {fixture.accounts.length > 0 && <div className="two-column"><Card title="Assets"><div className="account-list">{known.filter((a) => BigInt(r.balances[a.id]) >= 0n).map((a) => <div key={a.id}><span><Dot name={a.id === "savings" ? "Bills" : "Housing"} />{a.name}</span><strong>{money(r.balances[a.id])}</strong></div>)}</div></Card><Card title="Liabilities"><div className="account-list">{known.filter((a) => BigInt(r.balances[a.id]) < 0n).map((a) => <div key={a.id}><span>{a.name}</span><strong>{money(-BigInt(r.balances[a.id]))}</strong></div>)}{r.liabilities === "0" && <p className="compact-note">No outstanding posted balance.</p>}{r.liabilities === null && <p className="compact-note">History is incomplete; total debt is unavailable.</p>}</div></Card></div>}{unknown.length > 0 && <Card title="Balances awaiting history"><div className="account-list">{unknown.map((a) => <div key={a.id}><span>{a.name}</span><strong>Unavailable</strong></div>)}</div></Card>}</>;
}
function Settings({ appearance, onPreference, preferences, onPresentation, persistent, onExport, exportStatus, exportPeriod, onDemo }) {
  return <><Card title="Appearance" className="settings-card"><p className="settings-intro">Choose how Talarurus looks on this browser.</p><fieldset className="appearance-options"><legend className="sr-only">Appearance preference</legend>{[["light", "Light", "Always use the light theme."], ["dark", "Dark", "Always use the dark theme."], ["system", "System", "Follow your device\u2019s appearance."]].map(([value, label, note]) => <label key={value} className={`appearance-option ${appearance.preference === value ? "selected" : ""}`}><input type="radio" name="appearance" value={value} checked={appearance.preference === value} onChange={() => onPreference(value)} /><span className={`theme-preview preview-${value}`} aria-hidden="true"><i /><i /><i /></span><span><strong>{label}</strong><small>{note}</small></span></label>)}</fieldset><p className="appearance-status" role="status">{appearance.preference === "system" ? `System is currently using the ${appearance.theme} theme.` : `${appearance.theme === "dark" ? "Dark" : "Light"} theme is active.`} {appearance.persistent ? "Your choice is saved on this browser." : "Browser storage is unavailable; your choice lasts for this visit."}</p><p className="settings-motion">Motion follows your device’s Reduce Motion setting. You may also reduce it here; the app never overrides a device request to reduce motion.</p><div className="settings-fields"><label className="preference-check"><input type="checkbox" checked={preferences.reduceMotion} onChange={(e) => onPresentation({ ...preferences, reduceMotion: e.target.checked })} /><span>Reduce Motion<small>Use immediate transitions, even when your device allows motion.</small></span></label></div></Card><Card title="Formatting & privacy" className="settings-card"><div className="settings-fields"><label>USD display<select aria-label="USD display" value={preferences.format} onChange={(e) => onPresentation({ ...preferences, format: e.target.value })}><option value="symbol">Dollar sign — $1,234.56</option><option value="code">Currency code — USD 1,234.56</option></select><small>Presentation only. All balances remain USD; no currency conversion.</small></label><label className="preference-check"><input type="checkbox" checked={preferences.hidden} onChange={(e) => onPresentation({ ...preferences, hidden: e.target.checked })} /><span>Hide financial amounts<small>Mask amounts and percentages in cards, tables and details. Hide charts and their tooltips. Amount search and downloads are unavailable while hidden.</small></span></label><p className="compact-note" role="status">{persistent ? "Display preferences are saved on this browser." : "Browser storage is unavailable; display preferences last for this visit."} Only appearance and display choices are stored. Demo records are never written to browser preference storage. Hiding amounts is a display preference, not access control.</p></div></Card><Card title="Synthetic data" className="settings-card"><div className="settings-fields"><p className="compact-note">CSV period: {exportPeriod} · All demo accounts.</p><p className="compact-note">This prototype contains synthetic USD information only. The export is a transaction CSV for the selected report period, including pending entries and transfers; it is not a complete backup.</p><button className="export-button" disabled={preferences.hidden} onClick={onExport}><Icon name="download" /> Export selected-period transactions (CSV)</button>{preferences.hidden && <p className="compact-note">Show financial amounts to enable downloads.</p>}<p role="status" className="compact-note">{exportStatus}</p><button className="export-button" onClick={onDemo}>Choose synthetic demo data</button></div></Card></>;
}
function initialAppearance() {
  let storage;
  try {
    storage = typeof window !== "undefined" ? window.localStorage : void 0;
  } catch {
  }
  const preference = readPreference(storage);
  const dark = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return { preference, theme: resolveTheme(preference, dark), persistent: !!storage };
}
function Prototype({ preferences, onPresentation, presentationPersistent }) {
  const money = useMoney();
  const initial = new URLSearchParams(typeof location === "undefined" ? "" : location.search);
  const [page, setPage] = useState([...pages, ["settings"]].some((x) => x[0] === initial.get("page")) ? initial.get("page") : "cashflow");
  const [dataset, setDataset] = useState(Object.hasOwn(demos, initial.get("dataset")) ? initial.get("dataset") : "sample");
  const [period, setPeriod] = useState("09");
  const [txFilters, setTxFilters] = useState(initialTxFilters);
  const [spendingGroup, setSpendingGroup] = useState("categories");
  const [modal, setModal] = useState(null);
  const [origin, setOrigin] = useState(null), [exportStatus, setExportStatus] = useState("");
  const [appearance, setAppearance] = useState(initialAppearance);
  const appearanceController = useRef(null), returnFocus = useRef(null);
  const dialog = useRef(null), titleRef = useRef(null);
  const fixture = demos[dataset];
  const filters = period === "all" ? { start: "2026-07-01", end: "2026-10-01" } : { start: `2026-${period}-01`, end: `2026-${String(Number(period) + 1).padStart(2, "0")}-01` };
  const r = useMemo(() => report(fixture.accounts, fixture.transactions, filters), [fixture, filters.start, filters.end]);
  const title = page === "settings" ? "Settings" : pages.find((x) => x[0] === page)?.[1];
  useEffect(() => {
    let storage;
    try {
      storage = window.localStorage;
    } catch {
    }
    appearanceController.current = observeAppearance({ root: document.documentElement, storage, media: matchMedia("(prefers-color-scheme: dark)"), onChange: setAppearance });
    return () => appearanceController.current?.dispose();
  }, []);
  useEffect(() => {
    if (modal) {
      returnFocus.current = document.activeElement;
      dialog.current.showModal();
    } else if (dialog.current.open) {
      dialog.current.close();
      returnFocus.current?.focus();
    }
  }, [modal]);
  function navigate(id) {
    setPage(id);
    window.scrollTo({ top: 0, behavior: "instant" });
    const u = new URL(location.href);
    u.searchParams.set("page", id);
    if (location.protocol !== "file:") history.replaceState({}, "", u);
    requestAnimationFrame(() => titleRef.current?.focus());
  }
  function drill(f) {
    setOrigin({ page, label: title });
    setTxFilters({ ...initialTxFilters, ...f, status: "posted" });
    navigate("transactions");
  }
  function changePeriod(value) {
    setPeriod(value);
    setTxFilters(initialTxFilters);
    setOrigin(null);
    setExportStatus("");
  }
  function returnToChart() {
    const target = origin?.page || "cashflow";
    setOrigin(null);
    setTxFilters(initialTxFilters);
    navigate(target);
  }
  function changeDataset(id) {
    setDataset(id);
    changePeriod("09");
  }
  function downloadCSV() {
    if (preferences.hidden) return;
    try {
      downloadBlob(new Blob([transactionsCSV(fixture, filters)], { type: "text/csv;charset=utf-8" }), `talarurus-synthetic-${filters.start}.csv`);
      setExportStatus("Synthetic transaction CSV downloaded.");
    } catch {
      setExportStatus("Export could not be created. Please retry in a browser that supports downloads.");
    }
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  function download() {
    if (preferences.hidden) return;
    try {
      downloadBlob(new Blob([JSON.stringify({ notice: "Synthetic visual fixture only; not a tested production backup", ...fixture }, null, 2)], { type: "application/json" }), "synthetic-visual-fixture.json");
    } catch {
      setExportStatus("Export could not be created. Please retry in a browser that supports downloads.");
    }
  }
  const tabs = pages.map(([id, label, icon]) => <button key={id} className={page === id ? "nav-link active" : "nav-link"} aria-current={page === id ? "page" : void 0} onClick={() => navigate(id)}><Icon name={icon} /><span>{label}</span></button>);
  return <><a className="skip-link" href="#main">Skip to financial content</a><aside className="sidebar"><Brand /><nav aria-label="Primary navigation">{tabs}</nav><div className="sidebar-section"><span className="sidebar-caption">ACCOUNTS</span>{fixture.accounts.map((a) => <button className="account-nav" key={a.id} onClick={() => drill({ account: a.id })}><Icon name="home" />{a.name}</button>)}</div><div className="sidebar-bottom"><button className={page === "settings" ? "settings-nav active" : "settings-nav"} aria-current={page === "settings" ? "page" : void 0} onClick={() => navigate("settings")}><Icon name="settings" /> Settings</button><button onClick={() => setModal({ type: "more" })}><Icon name="shield" /> About this prototype</button><span>Synthetic data only</span></div></aside><main id="main" tabIndex="-1"><header className="page-header"><div><h1 tabIndex="-1" ref={titleRef}><span className="mobile-only"><Brand compact /></span>{title}</h1><p className="freshness">Synthetic data · No bank connections</p></div>{page !== "settings" && <div className="period-controls"><button className="square-button" aria-label="Previous period" disabled={period === "07" || period === "all" || dataset !== "sample"} onClick={() => changePeriod(String(Number(period) - 1).padStart(2, "0"))}><Icon name="left" /></button><span className="period-label">{period === "all" ? "Jul \u2013 Sep 2026" : { "07": "Jul", "08": "Aug", "09": "Sep" }[period] + " 2026"}</span><button className="square-button" aria-label="Next period" disabled={period === "09" || period === "all" || dataset !== "sample"} onClick={() => changePeriod(String(Number(period) + 1).padStart(2, "0"))}><Icon name="right" /></button><label className="period-select"><Icon name="calendar" /><select aria-label="Report period" value={period} onChange={(e) => changePeriod(e.target.value)}>{dataset === "sample" && <><option value="07">July</option><option value="08">August</option></>}<option value="09">September</option>{dataset === "sample" && <option value="all">Quarter to date</option>}</select></label><button className="prototype-button desktop-only" onClick={() => setModal({ type: "more" })}>Prototype info</button></div>}</header><div key={`${page}-${dataset}-${period}`} className="page-content"><ReportBoundary onDemo={() => setModal({ type: "more" })}>{page !== "settings" && page !== "transactions" && !r.complete && <p className="report-incomplete" role="status">Report incomplete: {r.unresolvedCount} posted records need classification. <button onClick={() => drill({ classification: "unclassified" })}>Review transactions</button></p>}{page === "settings" && <Settings appearance={appearance} onPreference={(value) => appearanceController.current?.setPreference(value)} preferences={preferences} onPresentation={onPresentation} persistent={presentationPersistent} onExport={downloadCSV} exportStatus={exportStatus} exportPeriod={period === "all" ? "July–September 2026" : ({ "07": "July", "08": "August", "09": "September" })[period] + " 2026"} onDemo={() => setModal({ type: "more" })} />} {page === "cashflow" && <CashFlow r={r} onDrill={drill} fixture={fixture} filters={filters} onDemo={() => setModal({ type: "more" })} />} {page === "spending" && <Spending group={spendingGroup} setGroup={setSpendingGroup} r={r} fixture={fixture} filters={filters} onDrill={drill} onDemo={() => setModal({ type: "more" })} />} {page === "transactions" && <Transactions fixture={fixture} period={filters} filters={txFilters} setFilters={setTxFilters} onDetail={(t) => setModal(t.prototypeAction ? { type: "add" } : { type: "transaction", transaction: t })} onFilterSheet={() => setModal({ type: "filters" })} onDemo={() => setModal({ type: "more" })} origin={origin?.label} onReturn={returnToChart} />} {page === "networth" && <NetWorth fixture={fixture} filters={filters} r={r} onDemo={() => setModal({ type: "more" })} />}</ReportBoundary></div><footer className="prototype-footer">Talarurus Finance · Private visual experiment · Synthetic USD data</footer></main><nav className="bottom-nav" aria-label="Mobile navigation">{tabs}<button className={page === "settings" ? "nav-link active" : "nav-link"} aria-current={page === "settings" ? "page" : void 0} aria-expanded={modal?.type === "more"} onClick={() => setModal({ type: "more" })}><Icon name="more" /><span>More</span></button></nav><dialog ref={dialog} aria-labelledby="dialog-title" className="detail-dialog" onCancel={() => setModal(null)} onClick={(e) => {
    if (e.target === dialog.current) setModal(null);
  }}><div className="dialog-heading"><h2 id="dialog-title">{modal?.type === "transaction" ? "Transaction details" : modal?.type === "filters" ? "Transaction filters" : modal?.type === "add" ? "Add transaction" : "About this prototype"}</h2><button aria-label="Close dialog" className="square-button" onClick={() => setModal(null)}><Icon name="close" /></button></div>{modal?.type === "transaction" && (() => {
    const t = modal.transaction;
    return <><div className="detail-amount">{money(t.amount, { signed: true })}</div><dl>{[["Merchant", t.payee], ["Date", t.date], ["Category", t.category], ["Account", fixture.accounts.find((a) => a.id === t.account)?.name], ["Status", t.status], ["Report treatment", t.status === "pending" ? "Excluded until posted" : t.classification === "transfer" ? "Moves between accounts; excluded from income and spending" : BigInt(t.amount) > 0n && t.classification === "expense" ? "Refund reduces category spending" : t.classification === "unclassified" ? "Excluded from income/spending until classified; included in posted account balances" : t.classification === "income" ? "Included in income" : "Included in spending"]].map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl><p className="compact-note">Details are view-only. Edits and receipt attachments are outside this visual experiment.</p></>;
  })()}{modal?.type === "filters" && <div className="filter-sheet"><label>Account<select value={txFilters.account} onChange={(e) => setTxFilters({ ...txFilters, account: e.target.value })}><option value="">All accounts</option>{fixture.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Category<select value={txFilters.category} onChange={(e) => setTxFilters({ ...txFilters, category: e.target.value })}><option value="">All categories</option>{[...new Set(fixture.transactions.map((t) => t.category))].sort().map((c) => <option key={c}>{c}</option>)}</select></label><button className="orange-button" onClick={() => setModal(null)}>Show transactions</button><button onClick={() => setTxFilters(initialTxFilters)}>Clear filters</button></div>}{modal?.type === "add" && <p>Prototype-only action. Creating or editing transactions is tested in the separate feasibility harness; this visual prototype does not save records.</p>}{modal?.type === "more" && <div className="about-sheet"><button onClick={() => {
    setModal(null);
    navigate("settings");
  }}><Icon name="settings" /> Appearance settings</button><p>Original interface inspired by the supplied SharkFin references. This experiment uses deterministic synthetic records and has no banking or sign-in. Only appearance and display preferences are saved in this browser.</p><label>Demo data<select aria-label="Demo data" value={dataset} onChange={(e) => changeDataset(e.target.value)}>{Object.entries(demos).map(([id, demo]) => <option key={id} value={id}>{demo.name}</option>)}</select></label><button onClick={download} disabled={preferences.hidden}><Icon name="download" /> Download synthetic visual data</button><p role="status" className="compact-note">{exportStatus}</p><p className="compact-note">This download is a fixture, not a production backup. Chart drill-down, search, filters, periods and navigation work. Add, edit, bank sync and authentication are not implemented here.</p></div>}</dialog></>;
}
function browserStorage() {
  try {
    return typeof window === "undefined" ? void 0 : window.localStorage;
  } catch {
    return void 0;
  }
}
function App({ presentation } = {}) {
  const [preferences, setPreferences] = useState(() => presentation || readPresentation(browserStorage()));
  const [persistent, setPersistent] = useState(() => {
    try {
      return !!browserStorage() && browserStorage().getItem("talarurus.presentation") !== void 0;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      document.documentElement.dataset.motion = reducedMotion(preferences, media.matches) ? "reduce" : "normal";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preferences.reduceMotion]);
  function change(value) {
    setPreferences(value);
    setPersistent(savePresentation(browserStorage(), value));
  }
  return <PresentationContext.Provider value={preferences}><Prototype preferences={preferences} onPresentation={change} presentationPersistent={persistent} /></PresentationContext.Provider>;
}
if (typeof document !== "undefined") createRoot(document.getElementById("root")).render(<App />);
export {
  App,
  DataTable,
  FlowLink,
  FlowNode
};
