/**
 * Interactive family tree visualization using D3.js.
 * Force-directed graph with drag/drop, context menus, and RAP annotations.
 * Differentiates edge types: parent→child (solid arrow), spouse (dashed, ♥).
 */

import * as d3 from 'd3';
import { addPerson, addChild, addSpouse, removePerson, createPerson, generateId } from '../models/familyTree.js';

const NODE_RADIUS = 28;
const COLORS = {
  alive: '#6366f1',       // indigo
  dead: '#64748b',        // slate
  testator: '#f43f5e',    // rose
  validating: '#22c55e',  // green
  violation: '#ef4444',   // red
  spouse: '#a78bfa',      // violet dashed
  child: '#94a3b8',       // slate for edges
  highlight: '#f59e0b',   // amber
};

/**
 * Render the family tree into the given container.
 */
export function renderFamilyTree(container, tree, options = {}) {
  const { onTreeChange, rapResults, onNodeClick } = options;

  container.innerHTML = '';

  const width = container.clientWidth || 700;
  const height = container.clientHeight || 500;

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  // Defs for markers and gradients
  const defs = svg.append('defs');

  // Glow filter
  const filter = defs.append('filter').attr('id', 'glow');
  filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
  const feMerge = filter.append('feMerge');
  feMerge.append('feMergeNode').attr('in', 'coloredBlur');
  feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

  // Arrow marker for parent→child edges
  defs.append('marker')
    .attr('id', 'arrow-child')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', NODE_RADIUS + 10)
    .attr('refY', 0)
    .attr('markerWidth', 7)
    .attr('markerHeight', 7)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-4L8,0L0,4')
    .attr('fill', COLORS.child)
    .attr('opacity', 0.7);

  // Background gradient
  const bgGrad = defs.append('linearGradient').attr('id', 'bgGrad').attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%');
  bgGrad.append('stop').attr('offset', '0%').attr('stop-color', '#0f172a');
  bgGrad.append('stop').attr('offset', '100%').attr('stop-color', '#1e293b');

  svg.append('rect').attr('width', width).attr('height', height).attr('fill', 'url(#bgGrad)').attr('rx', 12);

  // Build nodes and links from tree
  const nodes = [];
  const links = [];

  const rapResultMap = new Map();
  if (rapResults) {
    for (const r of rapResults) {
      if (r.validatingLife) {
        for (const [id, p] of tree.persons) {
          if (p.name === r.validatingLife) {
            rapResultMap.set(id, 'validating');
          }
        }
      }
    }
  }

  for (const [id, person] of tree.persons) {
    let rapStatus = rapResultMap.get(id) || null;
    nodes.push({
      id,
      name: person.name,
      alive: person.alive,
      isTestator: id === tree.testatorId,
      rapStatus,
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
    });
  }

  for (const [id, person] of tree.persons) {
    // Parent→child links
    for (const childId of person.childIds) {
      if (!links.find(l => l.source === id && l.target === childId && l.type === 'child')) {
        links.push({ source: id, target: childId, type: 'child' });
      }
    }
    // Spouse links
    for (const spouseId of person.spouseIds) {
      if (id < spouseId) {
        links.push({ source: id, target: spouseId, type: 'spouse' });
      }
    }
  }

  // Force simulation
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(d => d.type === 'spouse' ? 80 : 120).strength(0.8))
    .force('charge', d3.forceManyBody().strength(-400))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(NODE_RADIUS + 15))
    .force('y', d3.forceY().strength(0.05));

  // ─── Draw links ───
  const link = svg.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', d => d.type === 'spouse' ? COLORS.spouse : COLORS.child)
    .attr('stroke-width', d => d.type === 'spouse' ? 2 : 2)
    .attr('stroke-dasharray', d => d.type === 'spouse' ? '6,4' : 'none')
    .attr('opacity', 0.6)
    .attr('marker-end', d => d.type === 'child' ? 'url(#arrow-child)' : 'none');

  // ─── Link labels ───
  const linkLabel = svg.append('g')
    .selectAll('g')
    .data(links.filter(d => d.type === 'spouse'))
    .join('g');

  // Background pill for label readability
  linkLabel.append('rect')
    .attr('rx', 6)
    .attr('ry', 6)
    .attr('fill', 'rgba(15, 23, 42, 0.85)')
    .attr('stroke', 'rgba(167,139,250,0.3)')
    .attr('stroke-width', 1);

  linkLabel.append('text')
    .text('♥')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('font-size', '10px')
    .attr('font-weight', '600')
    .attr('fill', COLORS.spouse)
    .attr('pointer-events', 'none');

  // Size the pill backgrounds to fit the text
  linkLabel.each(function () {
    const g = d3.select(this);
    const text = g.select('text');
    const rect = g.select('rect');
    // Defer sizing to after the DOM is ready
    setTimeout(() => {
      const bbox = text.node()?.getBBox();
      if (bbox) {
        rect.attr('x', bbox.x - 4).attr('y', bbox.y - 2)
          .attr('width', bbox.width + 8).attr('height', bbox.height + 4);
      }
    }, 50);
  });

  // ─── Node groups ───
  const nodeGroup = svg.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('cursor', 'grab')
    .call(d3.drag()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      })
    );

  // Node circles
  nodeGroup.append('circle')
    .attr('r', NODE_RADIUS)
    .attr('fill', d => {
      if (d.isTestator) return COLORS.testator;
      if (d.rapStatus === 'validating') return COLORS.validating;
      if (d.rapStatus === 'violation') return COLORS.violation;
      return d.alive ? COLORS.alive : COLORS.dead;
    })
    .attr('stroke', d => {
      if (d.rapStatus === 'validating') return '#86efac';
      if (d.rapStatus === 'violation') return '#fca5a5';
      return 'rgba(255,255,255,0.2)';
    })
    .attr('stroke-width', d => d.rapStatus ? 3 : 1.5)
    .attr('filter', d => d.rapStatus ? 'url(#glow)' : 'none')
    .attr('opacity', d => (d.rapStatus || d.isTestator) ? 1 : 0.85)
    .on('click', (event, d) => {
      if (onNodeClick) onNodeClick(d, event);
    });

  // Alive/dead indicator
  nodeGroup.append('circle')
    .attr('r', 5)
    .attr('cx', NODE_RADIUS - 5)
    .attr('cy', -NODE_RADIUS + 5)
    .attr('fill', d => d.alive ? '#22c55e' : '#ef4444')
    .attr('stroke', '#0f172a')
    .attr('stroke-width', 1.5);

  // Name labels
  nodeGroup.append('text')
    .text(d => d.name)
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('font-size', '11px')
    .attr('font-weight', '600')
    .attr('fill', 'white')
    .attr('pointer-events', 'none');

  // Role labels (below)
  nodeGroup.append('text')
    .text(d => {
      if (d.isTestator) return 'T';
      if (d.rapStatus === 'validating') return '✓';
      return '';
    })
    .attr('text-anchor', 'middle')
    .attr('dy', NODE_RADIUS + 14)
    .attr('font-size', '14px')
    .attr('font-weight', 'bold')
    .attr('fill', d => {
      if (d.isTestator) return COLORS.testator;
      if (d.rapStatus === 'validating') return COLORS.validating;
      return '#94a3b8';
    })
    .attr('pointer-events', 'none');

  // Context menu on right-click
  nodeGroup.on('contextmenu', (event, d) => {
    event.preventDefault();
    showContextMenu(event, d, tree, container, onTreeChange);
  });

  // Tick function
  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    linkLabel
      .attr('transform', d => {
        const mx = (d.source.x + d.target.x) / 2;
        const my = (d.source.y + d.target.y) / 2;
        return `translate(${mx},${my})`;
      });

    nodeGroup.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  // ─── Legend ───
  const legendY = height - 140;
  const legend = svg.append('g').attr('transform', `translate(16, ${legendY})`);

  // Background for legend readability
  legend.append('rect')
    .attr('x', -8).attr('y', -12).attr('width', 160).attr('height', 132)
    .attr('rx', 8).attr('fill', 'rgba(15, 23, 42, 0.7)')
    .attr('stroke', 'rgba(99, 102, 241, 0.15)').attr('stroke-width', 1);

  // Node legend
  const nodeLegendItems = [
    { color: COLORS.alive, label: 'Alive' },
    { color: COLORS.dead, label: 'Deceased' },
    { color: COLORS.testator, label: 'Testator (T)' },
    { color: COLORS.validating, label: 'Measuring Life (✓)' },
  ];
  nodeLegendItems.forEach((item, i) => {
    const g = legend.append('g').attr('transform', `translate(0, ${i * 18})`);
    g.append('circle').attr('r', 5).attr('fill', item.color).attr('opacity', 0.9);
    g.append('text').attr('x', 14).attr('dy', '0.35em').text(item.label)
      .attr('fill', '#cbd5e1').attr('font-size', '10px');
  });

  // Edge legend
  const edgeLegendY = nodeLegendItems.length * 18 + 8;

  // Parent→Child edge
  const childEdge = legend.append('g').attr('transform', `translate(0, ${edgeLegendY})`);
  childEdge.append('line')
    .attr('x1', -4).attr('y1', 0).attr('x2', 24).attr('y2', 0)
    .attr('stroke', COLORS.child).attr('stroke-width', 2).attr('opacity', 0.7);
  childEdge.append('path')
    .attr('d', 'M20,-3L26,0L20,3')
    .attr('fill', COLORS.child).attr('opacity', 0.7);
  childEdge.append('text').attr('x', 32).attr('dy', '0.35em').text('Parent → Child')
    .attr('fill', '#cbd5e1').attr('font-size', '10px');

  // Spouse edge
  const spouseEdge = legend.append('g').attr('transform', `translate(0, ${edgeLegendY + 18})`);
  spouseEdge.append('line')
    .attr('x1', -4).attr('y1', 0).attr('x2', 24).attr('y2', 0)
    .attr('stroke', COLORS.spouse).attr('stroke-width', 2)
    .attr('stroke-dasharray', '6,4').attr('opacity', 0.7);
  spouseEdge.append('text').attr('x', 32).attr('dy', '0.35em').text('♥ Spouse')
    .attr('fill', COLORS.spouse).attr('font-size', '10px');

  return { simulation, svg };
}

/**
 * Show a right-click context menu on a node.
 */
function showContextMenu(event, nodeData, tree, container, onTreeChange) {
  d3.selectAll('.tree-context-menu').remove();

  const menu = d3.select(container)
    .append('div')
    .attr('class', 'tree-context-menu')
    .style('position', 'absolute')
    .style('left', `${event.offsetX}px`)
    .style('top', `${event.offsetY}px`)
    .style('background', 'rgba(30, 41, 59, 0.95)')
    .style('border', '1px solid rgba(99, 102, 241, 0.3)')
    .style('border-radius', '8px')
    .style('padding', '4px 0')
    .style('backdrop-filter', 'blur(12px)')
    .style('z-index', '1000')
    .style('min-width', '160px')
    .style('box-shadow', '0 8px 32px rgba(0,0,0,0.4)');

  const items = [
    { label: '👶 Add Child', action: 'add_child' },
    { label: '👫 Add Sibling', action: 'add_sibling' },
    { label: '💍 Add Spouse', action: 'add_spouse' },
    { label: nodeData.alive ? '💀 Mark Deceased' : '💚 Mark Alive', action: 'toggle_alive' },
    { label: '🗑️ Remove', action: 'remove' },
  ];

  items.forEach(item => {
    menu.append('div')
      .text(item.label)
      .style('padding', '8px 16px')
      .style('cursor', 'pointer')
      .style('color', '#e2e8f0')
      .style('font-size', '13px')
      .style('transition', 'background 0.15s')
      .on('mouseenter', function () { d3.select(this).style('background', 'rgba(99, 102, 241, 0.2)'); })
      .on('mouseleave', function () { d3.select(this).style('background', 'transparent'); })
      .on('click', (event) => {
        event.stopPropagation();
        d3.select('body').on('click.context-menu', null);
        menu.remove();
        handleContextAction(item.action, nodeData, tree, onTreeChange);
      });
  });

  setTimeout(() => {
    d3.select('body').on('click.context-menu', () => {
      menu.remove();
      d3.select('body').on('click.context-menu', null);
    });
  }, 100);
}

/**
 * Handle a context menu action.
 */
async function handleContextAction(action, nodeData, tree, onTreeChange) {
  switch (action) {
    case 'add_child': {
      const name = await customPrompt('Enter child\'s name:');
      if (!name) return;
      const child = createPerson({ id: generateId(), name, alive: true, gender: 'unknown' });
      addPerson(tree, child);
      addChild(tree, nodeData.id, child.id);
      break;
    }
    case 'add_sibling': {
      const name = await customPrompt('Enter sibling\'s name:');
      if (!name) return;
      const sibling = createPerson({ id: generateId(), name, alive: true, gender: 'unknown' });
      addPerson(tree, sibling);
      const person = tree.persons.get(nodeData.id);
      if (person) {
        for (const parentId of person.parentIds) {
          addChild(tree, parentId, sibling.id);
        }
      }
      break;
    }
    case 'add_spouse': {
      const name = await customPrompt('Enter spouse\'s name:');
      if (!name) return;
      const spouse = createPerson({ id: generateId(), name, alive: true, gender: 'unknown' });
      addPerson(tree, spouse);
      addSpouse(tree, nodeData.id, spouse.id);
      break;
    }
    case 'toggle_alive': {
      const person = tree.persons.get(nodeData.id);
      if (person) {
        person.alive = !person.alive;
        if (!person.alive) person.deathYear = new Date().getFullYear();
        else person.deathYear = null;
      }
      break;
    }
    case 'remove': {
      const ok = await customConfirm(`Remove ${nodeData.name} from the family tree?`);
      if (ok) {
        removePerson(tree, nodeData.id);
      } else {
        return;
      }
      break;
    }
  }

  if (onTreeChange) onTreeChange(tree);
}

/**
 * Custom HTML Prompt to avoid native alert blocking
 */
function customPrompt(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
      background: '#1e293b', padding: '24px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      width: '300px', display: 'flex', flexDirection: 'column', gap: '16px', color: '#f8fafc',
      border: '1px solid rgba(99, 102, 241, 0.3)', fontFamily: 'system-ui, -apple-system, sans-serif'
    });

    const label = document.createElement('div');
    label.textContent = message;
    label.style.fontWeight = '500';

    const input = document.createElement('input');
    Object.assign(input.style, {
      padding: '8px 12px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', outline: 'none'
    });
    
    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' });

    const btnCancel = document.createElement('button');
    btnCancel.textContent = 'Cancel';
    Object.assign(btnCancel.style, { padding: '6px 12px', background: '#334155', color: '#f8fafc', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' });
    btnCancel.onclick = () => { document.body.removeChild(overlay); resolve(null); };

    const btnOk = document.createElement('button');
    btnOk.textContent = 'OK';
    Object.assign(btnOk.style, { padding: '6px 12px', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' });
    btnOk.onclick = () => { document.body.removeChild(overlay); resolve(input.value.trim()); };

    input.onkeydown = e => {
      if (e.key === 'Enter') btnOk.click();
      if (e.key === 'Escape') btnCancel.click();
    };

    btnRow.appendChild(btnCancel);
    btnRow.appendChild(btnOk);
    box.appendChild(label);
    box.appendChild(input);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    input.focus();
  });
}

/**
 * Custom HTML Confirm to avoid native alert blocking
 */
function customConfirm(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
      background: '#1e293b', padding: '24px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      width: '300px', display: 'flex', flexDirection: 'column', gap: '16px', color: '#f8fafc',
      border: '1px solid rgba(99, 102, 241, 0.3)', fontFamily: 'system-ui, -apple-system, sans-serif'
    });

    const label = document.createElement('div');
    label.textContent = message;
    label.style.fontWeight = '500';

    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' });

    const btnCancel = document.createElement('button');
    btnCancel.textContent = 'Cancel';
    Object.assign(btnCancel.style, { padding: '6px 12px', background: '#334155', color: '#f8fafc', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' });
    btnCancel.onclick = () => { document.body.removeChild(overlay); resolve(false); };

    const btnOk = document.createElement('button');
    btnOk.textContent = 'Confirm';
    Object.assign(btnOk.style, { padding: '6px 12px', background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' });
    btnOk.onclick = () => { document.body.removeChild(overlay); resolve(true); };

    btnRow.appendChild(btnCancel);
    btnRow.appendChild(btnOk);
    box.appendChild(label);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
}
