/**
 * KStates DSL Parser (JavaScript)
 *
 * Parses the KStates textual DSL format into a JavaScript object structure.
 * This is a simplified recursive-descent parser that handles:
 * - STATEMACHINE header
 * - STATES block with nested state definitions
 * - TRANSITIONS block
 * - Action blocks (ENTRY / DO) with SET, APPEND, EVENT actions
 *
 * The output structure mirrors the Kotlin StateMachine/State/Transition model.
 */
const KStatesParser = (() => {

    function parse(input) {
        const tokens = tokenize(input);
        const parser = { tokens, pos: 0 };
        return parseStateMachine(parser);
    }

    // --- Tokenizer ---

    function tokenize(input) {
        const tokens = [];
        let i = 0;
        const len = input.length;

        while (i < len) {
            // Skip whitespace
            if (/\s/.test(input[i])) { i++; continue; }

            // Skip line comments
            if (input[i] === '/' && input[i + 1] === '/') {
                while (i < len && input[i] !== '\n') i++;
                continue;
            }

            // String literal
            if (input[i] === '"') {
                let str = '';
                i++; // skip opening quote
                while (i < len && input[i] !== '"') {
                    if (input[i] === '\\' && i + 1 < len) {
                        str += input[i + 1];
                        i += 2;
                    } else {
                        str += input[i];
                        i++;
                    }
                }
                i++; // skip closing quote
                tokens.push({ type: 'STRING', value: str });
                continue;
            }

            // Braces and parens
            if (input[i] === '{') { tokens.push({ type: 'LBRACE' }); i++; continue; }
            if (input[i] === '}') { tokens.push({ type: 'RBRACE' }); i++; continue; }
            if (input[i] === '(') { tokens.push({ type: 'LPAREN' }); i++; continue; }
            if (input[i] === ')') { tokens.push({ type: 'RPAREN' }); i++; continue; }
            if (input[i] === ',') { tokens.push({ type: 'COMMA' }); i++; continue; }

            // Arrow ->
            if (input[i] === '-' && input[i + 1] === '>') {
                tokens.push({ type: 'ARROW' });
                i += 2;
                continue;
            }

            // EVAL block — capture everything inside braces, handling nesting
            // We detect this contextually when we see 'EVAL' keyword followed by '{'
            // For now, tokenize EVAL as a keyword, and handle brace-counting in the parser

            // Keywords and identifiers
            if (/[a-zA-Z_]/.test(input[i])) {
                let word = '';
                while (i < len && /[a-zA-Z_0-9]/.test(input[i])) {
                    word += input[i];
                    i++;
                }
                tokens.push({ type: 'WORD', value: word });
                continue;
            }

            // Skip unknown characters
            i++;
        }

        return tokens;
    }

    // --- Parser Helpers ---

    function peek(p, offset) {
        return p.tokens[p.pos + (offset || 0)] || null;
    }

    function consume(p) {
        return p.tokens[p.pos++];
    }

    function expect(p, type, value) {
        const t = consume(p);
        if (!t || t.type !== type || (value !== undefined && t.value !== value)) {
            throw new Error(`Expected ${type}${value ? '(' + value + ')' : ''} but got ${t ? t.type + '(' + (t.value || '') + ')' : 'EOF'} at position ${p.pos - 1}`);
        }
        return t;
    }

    function match(p, type, value) {
        const t = peek(p);
        if (t && t.type === type && (value === undefined || t.value === value)) {
            return consume(p);
        }
        return null;
    }

    // --- Grammar ---

    function parseStateMachine(p) {
        expect(p, 'WORD', 'STATEMACHINE');
        expect(p, 'WORD', 'ATTACHED');
        expect(p, 'WORD', 'TO');
        const attachedTo = expect(p, 'STRING').value;
        expect(p, 'LBRACE');

        let states = [];
        let transitions = [];

        // Parse blocks inside STATEMACHINE { ... }
        while (peek(p) && peek(p).type !== 'RBRACE') {
            const t = peek(p);
            if (t.type === 'WORD' && t.value === 'STATES') {
                consume(p);
                states = parseStatesBlock(p);
            } else if (t.type === 'WORD' && t.value === 'TRANSITIONS') {
                consume(p);
                transitions = parseTransitionsBlock(p);
            } else if (t.type === 'WORD' && t.value === 'MACROS') {
                // Skip macros block (not needed for visualization)
                consume(p);
                skipBraceBlock(p);
            } else {
                consume(p); // skip unexpected token
            }
        }

        expect(p, 'RBRACE');

        return { attachedTo, states, transitions };
    }

    function parseStatesBlock(p) {
        expect(p, 'LBRACE');
        const states = [];
        while (peek(p) && peek(p).type !== 'RBRACE') {
            states.push(parseStateDefinition(p));
        }
        expect(p, 'RBRACE');
        return states;
    }

    function parseStateDefinition(p) {
        let isInitial = false;
        if (peek(p) && peek(p).type === 'WORD' && peek(p).value === 'INITIAL') {
            consume(p);
            isInitial = true;
        }
        expect(p, 'WORD', 'STATE');
        const name = expect(p, 'STRING').value;
        expect(p, 'LBRACE');

        let onEntry = [];
        let onDo = [];
        const innerStates = [];

        while (peek(p) && peek(p).type !== 'RBRACE') {
            const t = peek(p);
            if (t.type === 'WORD' && t.value === 'ENTRY') {
                consume(p);
                onEntry = parseActionBlock(p);
            } else if (t.type === 'WORD' && t.value === 'DO') {
                consume(p);
                onDo = parseActionBlock(p);
            } else if (t.type === 'WORD' && (t.value === 'STATE' || t.value === 'INITIAL')) {
                innerStates.push(parseStateDefinition(p));
            } else {
                consume(p); // skip unexpected
            }
        }

        expect(p, 'RBRACE');

        return { name, isInitial, onEntry, onDo, innerStates };
    }

    function parseActionBlock(p) {
        expect(p, 'LBRACE');
        const actions = [];
        while (peek(p) && peek(p).type !== 'RBRACE') {
            const t = peek(p);
            if (t.type === 'WORD' && (t.value === 'SET' || t.value === 'APPEND' || t.value === 'EVENT')) {
                actions.push(parseActionRule(p));
            } else {
                consume(p); // skip
            }
        }
        expect(p, 'RBRACE');
        return actions;
    }

    function parseActionRule(p) {
        const op = consume(p).value; // SET, APPEND, EVENT
        expect(p, 'LPAREN');
        const leftSide = expect(p, 'STRING').value;
        expect(p, 'COMMA');

        let rightSide;
        const next = peek(p);
        if (next && next.type === 'WORD' && next.value === 'MACRO') {
            consume(p); // MACRO
            expect(p, 'LPAREN');
            const macroName = expect(p, 'STRING').value;
            const args = [];
            while (match(p, 'COMMA')) {
                args.push(expect(p, 'STRING').value);
            }
            expect(p, 'RPAREN');
            rightSide = { type: 'macro', macroName, args };
        } else if (next && next.type === 'WORD' && next.value === 'EVAL') {
            consume(p); // EVAL
            const code = captureEvalBlock(p);
            rightSide = { type: 'eval', code };
        } else if (next && next.type === 'STRING') {
            rightSide = { type: 'value', value: consume(p).value };
        } else {
            // Skip unknown right side
            rightSide = { type: 'unknown' };
            consume(p);
        }

        expect(p, 'RPAREN');
        return { operation: op, leftSide, rightSide };
    }

    function parseTransitionsBlock(p) {
        expect(p, 'LBRACE');
        const transitions = [];
        while (peek(p) && peek(p).type !== 'RBRACE') {
            const t = peek(p);
            if (t.type === 'WORD' && t.value === 'TRANSITION') {
                transitions.push(parseTransition(p));
            } else {
                consume(p);
            }
        }
        expect(p, 'RBRACE');
        return transitions;
    }

    function parseTransition(p) {
        expect(p, 'WORD', 'TRANSITION');
        const fromState = expect(p, 'STRING').value;
        expect(p, 'ARROW');
        const toState = expect(p, 'STRING').value;

        let allowLoops = true;
        if (peek(p) && peek(p).type === 'WORD' && peek(p).value === 'NOT') {
            consume(p); // NOT
            expect(p, 'WORD', 'LOOPING');
            allowLoops = false;
        }

        expect(p, 'LBRACE');

        let condition = null;
        while (peek(p) && peek(p).type !== 'RBRACE') {
            const t = peek(p);
            if (t.type === 'WORD' && t.value === 'CONDITION') {
                consume(p);
                condition = parseConditionBlock(p);
            } else {
                consume(p);
            }
        }

        expect(p, 'RBRACE');

        return { fromState, toState, allowLoops, condition };
    }

    function parseConditionBlock(p) {
        expect(p, 'LBRACE');
        let condition = null;

        while (peek(p) && peek(p).type !== 'RBRACE') {
            const t = peek(p);
            if (t.type === 'WORD' && t.value === 'EVAL') {
                consume(p);
                const code = captureEvalBlock(p);
                condition = { type: 'eval', code };
            } else if (t.type === 'WORD' && t.value === 'EVENT') {
                consume(p);
                expect(p, 'LPAREN');
                const domain = expect(p, 'STRING').value;
                expect(p, 'COMMA');
                const value = expect(p, 'STRING').value;
                expect(p, 'RPAREN');
                condition = { type: 'event', domain, value };
            } else if (t.type === 'WORD' && t.value === 'VALUE') {
                consume(p);
                expect(p, 'LPAREN');
                const varKey = expect(p, 'STRING').value;
                expect(p, 'RPAREN');
                condition = { type: 'value', variableKey: varKey };
            } else {
                consume(p);
            }
        }

        expect(p, 'RBRACE');
        return condition;
    }

    /**
     * Captures the raw content inside an EVAL { ... } block,
     * handling nested braces. Returns the raw text stripped of outer braces.
     * Since our tokenizer doesn't preserve raw text, we skip the brace-delimited block.
     */
    function captureEvalBlock(p) {
        // We just skip the brace block — the eval code is not needed for visualization
        skipBraceBlock(p);
        return '...';
    }

    function skipBraceBlock(p) {
        expect(p, 'LBRACE');
        let depth = 1;
        while (depth > 0 && p.pos < p.tokens.length) {
            const t = consume(p);
            if (t.type === 'LBRACE') depth++;
            else if (t.type === 'RBRACE') depth--;
        }
    }

    // --- Public API ---

    /**
     * Collects all state names (including nested) into a flat list.
     */
    function getAllStateNames(states) {
        const names = [];
        function walk(stateList) {
            for (const s of stateList) {
                names.push(s.name);
                if (s.innerStates.length > 0) {
                    walk(s.innerStates);
                }
            }
        }
        walk(states);
        return names;
    }

    /**
     * Finds all states that have child states (compound/group states).
     */
    function getGroupStates(states) {
        const groups = [];
        function walk(stateList) {
            for (const s of stateList) {
                if (s.innerStates.length > 0) {
                    groups.push(s);
                    walk(s.innerStates);
                }
            }
        }
        walk(states);
        return groups;
    }

    /**
     * Finds the initial state stack (path from root to deepest initial state).
     */
    function getInitialStateStack(states) {
        const stack = [];
        function findInitial(stateList) {
            if (stateList.length === 0) return;
            const initial = stateList.find(s => s.isInitial) || stateList[0];
            stack.push(initial.name);
            if (initial.innerStates.length > 0) {
                findInitial(initial.innerStates);
            }
        }
        findInitial(states);
        return stack;
    }

    return { parse, getAllStateNames, getGroupStates, getInitialStateStack };
})();
