/**
 * State Machine Renderer using nomnoml
 *
 * Renders a parsed KStates statemachine as an SVG diagram using nomnoml.
 * Supports hierarchical/nested compound states using nomnoml's compartment syntax.
 * Uses a yellow UML statechart theme.
 */
const StateMachineRenderer = (() => {

    let containerEl = null;
    let activeStates = new Set();
    let currentSm = null;

    function init(container) {
        containerEl = container;
    }

    async function render(sm) {
        if (!containerEl) return;
        if (typeof nomnoml === 'undefined') {
            console.error('[StateMachineRenderer] nomnoml not loaded');
            containerEl.innerHTML = '<p style="color:#c62828;padding:20px;">nomnoml library not loaded.</p>';
            return;
        }
        currentSm = sm;
        renderDiagram();
    }

    function renderDiagram() {
        if (!currentSm || !containerEl) return;

        const source = buildNomnomlSource(currentSm);

        try {
            const svgStr = nomnoml.renderSvg(source);
            containerEl.innerHTML = svgStr;
            const svg = containerEl.querySelector('svg');
            if (svg) {
                svg.style.maxWidth = '100%';
                svg.style.height = 'auto';
            }
        } catch (err) {
            console.error('[StateMachineRenderer] Render error:', err);
            containerEl.innerHTML = '<p style="color:#c62828;padding:20px;">Render error: ' + escHtml(err.message) + '</p>';
        }
    }

    function buildNomnomlSource(sm) {
        const lines = [];

        // Build parent map: stateName -> parentStateName (null for root)
        const parentMap = {};
        const stateLookup = {};
        function mapStates(states, parent) {
            for (const s of states) {
                parentMap[s.name] = parent;
                stateLookup[s.name] = s;
                if (s.innerStates.length > 0) mapStates(s.innerStates, s.name);
            }
        }
        mapStates(sm.states, null);

        // Yellow UML statechart theme
        lines.push('#direction: down');
        lines.push('#fill: #FFFDE7');
        lines.push('#stroke: #C49000');
        lines.push('#font: system-ui, sans-serif');
        lines.push('#fontSize: 13');
        lines.push('#padding: 12');
        lines.push('#spacing: 50');
        lines.push('#leading: 1.5');
        lines.push('#lineWidth: 1.5');
        lines.push('#edges: rounded');
        lines.push('#arrowSize: 1');
        lines.push('#.compound: fill=#FFF9C4 visual=frame');
        lines.push('#.activeLeaf: fill=#C8E6C9 stroke=#388E3C bold visual=roundrect');
        lines.push('#.activeCompound: fill=#C8E6C9 stroke=#388E3C bold visual=frame');
        lines.push('');

        // State definitions (with nesting for compound states)
        for (const state of sm.states) {
            lines.push(buildStateNode(state, parentMap, sm.transitions));
        }
        lines.push('');

        // Initial state arrow
        const initialStack = KStatesParser.getInitialStateStack(sm.states);
        if (initialStack.length > 0) {
            lines.push('[<start>start] -> ' + stateRef(initialStack[0]));
        }

        // Collect top-level edges (dedup)
        const edgeSet = new Set();
        for (const tr of sm.transitions) {
            const srcParent = parentMap[tr.fromState];
            const tgtParent = parentMap[tr.toState];

            if (srcParent === null && tgtParent === null) {
                // Both top-level
                if (tr.fromState !== tr.toState) {
                    edgeSet.add(stateRef(tr.fromState) + ' -> ' + stateRef(tr.toState));
                }
            } else if (tgtParent === tr.fromState || srcParent === tr.toState) {
                // Parent-to-child or child-to-parent: skip (implied by nesting)
            } else if (srcParent === tgtParent && srcParent !== null) {
                // Siblings inside same compound: handled in buildStateNode
            } else {
                // Cross-hierarchy: show between top-level ancestors
                const srcTop = getTopLevelAncestor(tr.fromState, parentMap);
                const tgtTop = getTopLevelAncestor(tr.toState, parentMap);
                if (srcTop !== tgtTop) {
                    edgeSet.add(stateRef(srcTop) + ' -> ' + stateRef(tgtTop));
                }
            }
        }
        for (const edge of edgeSet) {
            lines.push(edge);
        }

        return lines.join('\n');
    }

    function buildStateNode(state, parentMap, transitions) {
        const isCompound = state.innerStates.length > 0;
        const name = escNomnoml(state.name);

        if (isCompound) {
            const cls = activeStates.has(state.name) ? 'activeCompound' : 'compound';

            // Build children
            const childLines = state.innerStates.map(
                child => buildStateNode(child, parentMap, transitions)
            );

            // Initial sub-state indicator inside compound
            const initialChild = state.innerStates.find(s => s.isInitial);
            if (initialChild) {
                childLines.unshift('[<start>start] -> ' + stateRef(initialChild.name));
            }

            // Sibling transitions within this compound
            const siblingEdgeSet = new Set();
            for (const tr of transitions) {
                if (parentMap[tr.fromState] === state.name && parentMap[tr.toState] === state.name) {
                    siblingEdgeSet.add(stateRef(tr.fromState) + ' -> ' + stateRef(tr.toState));
                }
            }
            for (const edge of siblingEdgeSet) {
                childLines.push(edge);
            }

            return '[<' + cls + '> ' + name + ' |\n' + childLines.join('\n') + '\n]';
        } else {
            const cls = activeStates.has(state.name) ? 'activeLeaf' : 'roundrect';
            return '[<' + cls + '> ' + name + ']';
        }
    }

    /**
     * Returns a nomnoml node reference matching its definition classifier.
     */
    function stateRef(name) {
        const state = findState(name);
        if (!state) return '[' + escNomnoml(name) + ']';

        const isCompound = state.innerStates.length > 0;
        const isActive = activeStates.has(name);

        if (isCompound) {
            const cls = isActive ? 'activeCompound' : 'compound';
            return '[<' + cls + '> ' + escNomnoml(name) + ']';
        } else {
            const cls = isActive ? 'activeLeaf' : 'roundrect';
            return '[<' + cls + '> ' + escNomnoml(name) + ']';
        }
    }

    function findState(name) {
        if (!currentSm) return null;
        function walk(states) {
            for (const s of states) {
                if (s.name === name) return s;
                if (s.innerStates.length > 0) {
                    const found = walk(s.innerStates);
                    if (found) return found;
                }
            }
            return null;
        }
        return walk(currentSm.states);
    }

    function getTopLevelAncestor(name, parentMap) {
        let current = name;
        while (parentMap[current] !== null && parentMap[current] !== undefined) {
            current = parentMap[current];
        }
        return current;
    }

    function setActiveStates(stateStack) {
        activeStates = new Set(stateStack);
        if (currentSm) renderDiagram();
    }

    function escNomnoml(s) {
        return s.replace(/[\[\]|#;]/g, '');
    }

    function escHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    return { init, render, setActiveStates };
})();
