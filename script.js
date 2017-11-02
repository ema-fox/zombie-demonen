let pr = console.log.bind(console);

Element.prototype.on = Element.prototype.addEventListener;
Element.prototype.once = function (event, handler) {
    return new Promise(resolve => {
        this.on(event, function wrapper(evt) {
            this.removeEventListener(event, wrapper);
            resolve(evt);
        });
    });
}

function* map(xs, f) {
    for (let x of xs) {
        yield f(x);
    }
}

range(0).constructor.prototype.map = function* (f) {
    yield* map(this, f);
}

range(0).constructor.prototype.each = function (f) {
    for (let x of this) {
        f(x);
    }
}

function wait_transition(el) {
    return new Promise(resolve => {
        let id = setTimeout(() => {
            pr("transition didn't end after one second");
            resolve();
        }, 1000);
        el.once('transitionend').then(() => {
            clearTimeout(id);
            resolve();
        });
    });
}

function shuffle(xs) {
    for (let i = 0; i < xs.length; i++) {
        let tmp = xs[i];
        let j = i + rand(xs.length - i);
        xs[i] = xs[j];
        xs[j] = tmp;
    }
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let size = 9;

let discover_foo = 5;
let discover_bar = 2;

/*

let foo = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

function to_roman(x) {
    let res = '';
    while (x > 0) {
        let [y, z] = foo.find(([y, z]) => x >= y);
        res += z;
        x -= y;
    }
    return res;
}
*/

function fade_out(el) {
    el.style.opacity = 0;
    return wait_transition(el).then(() => el.remove());
}

function do_swap(a, b) {
    let tmpx = a.x;
    let tmpy = a.y;
    a.x = b.x;
    a.y = b.y;
    b.x = tmpx;
    b.y = tmpy;
    return Promise.all([wait_transition(a), wait_transition(b)]);
}

function bomb(a, b) {
    let pending = [fade_out(a)];
    if (b.classList.contains('smash-h') || b.classList.contains('smash-v')) {
        [].forEach.call($s(`.${b.type}`), other => {
            other.classList.add('smash-' + rand_choice('hv'));
        });
    }
    [].forEach.call($s(`.${b.type}`), other => {
        pending.push(wait(rand(100)).then(() => remove(other)));
    });
    return Promise.all(pending);
}

function swap(a, b) {
    if (false && (a.classList.contains('smash-h') || a.classList.contains('smash-v')) &&
        (b.classList.contains('smash-h') || b.classList.contains('smash-v'))) {
        Promise.all([remove(a),
                     remove(b),
                     smash_h(a),
                     smash_v(a)]).then(step);
    } else if (a.classList.contains('bomb') && b.is_gem) {
        bomb(a, b).then(step);
    } else if (b.classList.contains('bomb') && a.is_gem) {
        bomb(b, a).then(step);
    } else {
        do_swap(a, b).then(reduce).then((did_remove) => {
            if (did_remove) {
                step();
            } else {
                do_swap(a, b);
            }
        });
    }
}


function _make_gem(x, y, type, text) {
    let gem = element('div', {'class': `gem ${type}`}, [create_text(text)]);
    gem.type = type;
    Object.defineProperty(gem, 'x', {
        'get': () => {
            return +gem.getAttribute('x');
        },
        'set': (x) => {
            gem.style.left = 5 + 95 * x;
            gem.setAttribute('x', x);
        }
    });
    Object.defineProperty(gem, 'y', {
        'get': () => {
            return +gem.getAttribute('y');
        },
        'set': (y) => {
            gem.style.top = 5 + 95 * y;
            gem.setAttribute('y', y);
        }
    });
    gem.is_gem = "ABCDE".indexOf(type) >= 0;
    gem.is_a = class_name => gem.classList.contains(class_name);

    gem.x = x;
    gem.y = y;
    gem.offsetHeight;

    return gem;
}

function make_smash_gem(x, y, type, orientation) {
    let gem = _make_gem(x, y, type, ' ');
    gem.classList.add('smash-' + orientation);
    return gem;
}

function make_bomb_gem(x, y) {
    return _make_gem(x, y, 'bomb', ' ');
}

function make_item_gem(x, y, item) {
    let gem = _make_gem(x, y, 'item', item.replace(/_/g, ' '));
    gem.setAttribute('item', item);
    return gem;
}

function make_stone(x, y, item) {
    let gem = _make_gem(x, y, 'stone', item.replace(/_/g, ' '));
    if (item !== 'stone') {
        gem.setAttribute('item', item);
    }
    gem.setAttribute('health', discover_bar);
    return gem;
}

function make_number_gem_with_type(x, y, type) {
    let gem = _make_gem(x, y, type, ' ');
    return gem;
}

function make_number_gem(x, y) {
    return make_number_gem_with_type(x, y, rand_choice("ABCDE"));
    //return make_number_gem_with_type(x, y, rand_choice("ABCD"));
}

function turn(side) {
    return side === 'a' ? 'b' : 'a';
}

function replace_gem(gem) {
    gem.style.opacity = 1;
    gem.offsetHeight;
    fade_out(gem);
    let new_gem = make_number_gem_with_type(gem.x, gem.y, gem.type);
    $('#map').append(new_gem);
    new_gem.style.opacity = 0;
    new_gem.offsetHeight;
    new_gem.style.opacity = 1;
}

let inventar = new Bag();

function make_recipe(input, output) {
    return {'input': new Bag(Object.entries(input)),
            'output': new Bag(Object.entries(output))};
}

function show_recipe(recipe) {
    return `${show_bag(recipe.input, ' ')} -> ${show_bag(recipe.output, ' ')}`;
}

function recipe_possible(recipe) {
    return inventar.contains(recipe.input);
}

let repaired = 0;

function select(gem) {
    gem.classList.add('selected');
    for (nbor of get_neighbors(gem)) {
        if (nbor.type !== 'stone') {
            nbor.classList.add('highlighted');
        }
    }
}

function add_click_listener() {
$('#map').on('click', event => {
    let gem = event.target;
    if (!gem.type) {
        return;
    }
    let selected = $('.selected');
    if (selected) {
        selected.classList.remove('selected');
        if (gem.classList.contains('highlighted')) {
            swap(gem, selected);
        }
        for (nbor of $s('.highlighted')) {
            nbor.classList.remove('highlighted');
        }
    } else {
        if (gem.type !== 'stone' && gem.type !== 'item') {
            select(gem);
        }
    }
});
}

function each_place(xr, yr, f) {
    for (let x of range(size - xr)) {
        for (let y of range(size - yr)) {
            f(x, y);
        }
    }
}

function each_place_upwards(f) {
    for (let x of range(size)) {
        for (let y of range(size)) {
            f(x, size - y - 1);
        }
    }
}

function get_gem(x, y) {
    return $(`[x="${x}"][y="${y}"]`);
}


function get_neighbors(gem) {
    let res = [get_gem(gem.x - 1, gem.y),
               get_gem(gem.x + 1, gem.y),
               get_gem(gem.x, gem.y - 1),
               get_gem(gem.x, gem.y + 1)];
    return res.filter(x => x);
}

function get_missing_numbers() {
    let res = [];
    for (let [id, [a, b]] of (get_cards_collection())) {
        if (!get_gem_by_id_and_side(id, 'a')) {
            res.push([id, 'a', a]);
        }
    }
    return res;
}

let first = true;

function start() {
    first = true;
    document.body.insertBefore(element('div', {'id': 'map'}, []), document.body.firstChild);
    add_click_listener();
    step();
}

function step() {
    let foos = [];

    each_place_upwards((x, y) => {
        if (!get_gem(x, y)) {
            for (let y2 = y; y2 >= 0; y2--) {
                let gem = get_gem(x, y2);
                if (!gem && y2 === 0) {
                    gem = places[current_place].make_gem(x, y);
                    gem.style.opacity = 1;
                    $('#map').append(gem);
                    gem.offsetHeight;
                }
                if (gem) {
                    gem.y = y;
                    foos.push(wait_transition(gem));
                    break;
                }
            }
        }
    });

    first = false;

    Promise.all(foos).then(() => wait(500)).then(reduce).then((did_remove) => {
        if (did_remove) {
            step();
        } else if (places[current_place].endp()) {
            let straglers = [].concat(Array.from($s('.smash-h')), Array.from($s('.smash-v')));
            let straglers2 = Array.from($s('.spare_part'));
            if (straglers.length || straglers2.length) {
                for (let gem of straglers) {
                    gem.classList.add('pulsating');
                }
                Promise.all(straglers2.map(fade_out)).then(step);
            } else {
                fade_out($('#map')).then(places[current_place].end);
            }
        }
    });
}

function show_bag(bag, seperator) {
    let txt = '';
    for (let [item, n] of bag) {
        txt += `${item.replace(/_/g, ' ')}: ${n}${seperator}`;
    }
    return txt
}

function show_inventer() {
    $('#counter').innerText = `${show_bag(inventar, '\n')}. pre: ${show_bag(pre_input, '\n')} post: ${show_bag(post_input, '\n')}.`
}


function touch(gem) {
    if (gem.type === 'stone') {
        gem.setAttribute('health', Math.max(0, gem.getAttribute('health') - 1))
        return wait(rand(100)).then(() => {
            gem.classList.add('touched');
        }).then(() => wait(400)).then(() => {
            if (gem.getAttribute('health') == 0) {
                gem.setAttribute('health', 'dead');
                let item = gem.getAttribute('item');
                if (item) {
                    inventar.incr(item);
                    show_inventer();
                }
                return fade_out(gem);
            } else {
                gem.classList.remove('touched');
            }
        });
    }
    return Promise.resolve();
}

function smash_h(gem) {
    let pending = [];
    for (let x of range(size)) {
        let knork = get_gem(x, gem.y);
        if (knork) {
            pending.push(wait(Math.abs(gem.x - x) * 100).then(() => {
                if (knork.classList.contains('smash-h')) {
                    knork.classList.add('pulsating');
                } else {
                    return remove(knork);
                }
            }));
        }
    }
    return Promise.all(pending);
}

function smash_v(gem) {
    let pending = [];
    for (let y of range(size)) {
        let knork = get_gem(gem.x, y);
        if (knork) {
            pending.push(wait(Math.abs(gem.y - y) * 100).then(() => {
                if (knork.classList.contains('smash-v')) {
                    knork.classList.add('pulsating');
                } else {
                    return remove(knork);
                }
            }));
        }
    }
    return Promise.all(pending);
}

function remove(gem) {
    let pending = [];
    pending.push(touch(gem));
    if (gem.style.opacity > 0 && gem.is_gem) {
        pending.push(fade_out(gem));
        for (let nbor of get_neighbors(gem)) {
            pending.push(touch(nbor));
        }
        if (gem.classList.contains('smash-h')) {
            pending.push(smash_h(gem));
        } else if (gem.classList.contains('smash-v')) {
            pending.push(smash_v(gem));
        }
    }
    return Promise.all(pending);
}

function scan_lines() {
    let lines = new Map();
    each_place(0, 2, (x, y) => {
        let gems = [get_gem(x, y)]
        gems.direction = 'h';
        if (gems[0].is_gem) {
            for (let i of range(1, 9)) {
                let gem = get_gem(x, y + i);
                if (gem && !gem.is_a('pulsating') && gem.type === gems[0].type) {
                    gems.push(gem);
                } else {
                    break;
                }
            }
            if (gems.length > 2) {
                for (let gem of gems) {
                    if (!lines.has(gem) || lines.get(gem).length < gems.length) {
                        lines.set(gem, gems)
                    }
                }
            }
        }
    });

    each_place(2, 0, (x, y) => {
        let gems = [get_gem(x, y)]
        gems.direction = 'v';
        if (gems[0].is_gem) {
            for (let i of range(1, 5)) {
                let gem = get_gem(x + i, y);
                if (gem && !gem.is_a('pulsating') && gem.type === gems[0].type) {
                    gems.push(gem);
                } else {
                    break;
                }
            }
            if (gems.length > 2) {
                for (let gem of gems) {
                    if (!lines.has(gem) || lines.get(gem).length < gems.length) {
                        lines.set(gem, gems)
                    }
                }
            }
        }
    });
    return new Set(lines.values());
}

function reduce() {
    let foos = [];
    let lines = scan_lines();
    lines.forEach(gems => {
        gems.forEach(gem => {
            foos.push(remove(gem));
        });
        if (gems.length === 4) {
            let gem = make_smash_gem(rand_choice(gems).x, rand_choice(gems).y, gems[0].type, gems.direction);
            $('#map').append(gem);
            gem.style.opacity = 0;
            gem.offsetHeight;
            gem.style.opacity = 1;
        } else if (gems.length >= 5) {
            let gem = make_bomb_gem(rand_choice(gems).x, rand_choice(gems).y);
            $('#map').append(gem);
            gem.style.opacity = 0;
            gem.offsetHeight;
            gem.style.opacity = 1;
        }
    });

    if (!foos.length) {
        let ps = $s('.pulsating');
        for (let gem of ps) {
            foos.push(remove(gem));
            break;
        }
    }

    range(size).each(x => {
        let gem = get_gem(x, size - 1);
        if (gem && gem.type === 'item') {
            gem.style.opacity = 0;
            foos.push(wait_transition(gem).then(() => {
                gem.remove();
            }));
            post_input.incr(gem.getAttribute('item'));
            show_inventer();
        }
    });

    return Promise.all(foos).then(() => {
        return !!foos.length;
    });
}

let path_is_free = false;
let discovered = false;
let studied_broken_layer_hopper = false;

function menu() {
    choice(
        '?',
        /*
        discoverables.filter(d => d.p())
            .map(d => {
                return [d.name, () => do_discover(d)];
            })
            .concat(recipes.filter(r => r.p()).map(recipe => {
                return [
                    show_recipe(recipe),
                    () => do_recipe(recipe),
                    !recipe_possible(recipe)
                ];
            }),
        */
                    menu_entries.filter(e => e.p()).map(e => {
                        return [
                            e.name,
                            e.f
                        ];
                    }));
    //);
}

let current_recipe;
let pre_input = new Bag();
let post_input = new Bag();

function do_recipe(recipe) {
    current_recipe = recipe;
    pre_input = inventar.remove(recipe.input);
    post_input = new Bag();
    current_place = 'do_recipe';
    wait(1000).then(start);
}

function end_recipe() {

}

let current_end;
let current_stone_choices = ['stone'];

function do_discover(discoverable) {
    discover_foo = discoverable.foo;
    discover_bar = discoverable.bar;
    current_end = discoverable.end;
    current_discover = new Bag(discoverable.items());
    current_discover.set('stone', 9 * (9 - discover_foo) - current_discover.size());
    current_place = 'discover';
    wait(1000).then(start);
}

var current_place = 'discover';

message("Komplett dehydriert wachst du in einem Krankenhausbett auf")
    .then(() => message("Langsam kommt die Erinnerung an den Carcrash zurück"))
    .then(() => message("Du fühlst dich als ob du seit Wochen im Koma lagst"))
    .then(() => message("Das Zimmer in dem du dich befindest ist komplett verwüsted"))
    .then(() => wait(1000)).then(menu);

function end_discover() {
    if (current_end) {
        current_end();
    }
    message(`You found ${inventar.get('spare_part')} spare parts.`)
        .then(() => message("Yay!"))
        .then(menu);
}

function end_repair() {
    message("You repaired your layer hopper!")
        .then(() => message("You can now travel back to your home layer."));
}

places = {
    'discover': {
        'end': end_discover,
        'endp': () => {
            return !$s('.stone').length;
        },
        'make_gem': (x, y) => {
            if (y < discover_foo || !first) {
                return make_number_gem(x, y - size);
            } else {
                return make_stone(x, y - size, current_discover.pop_rand());
            }
        }
    },
    'research': {
        'end': () => current_end(),
        'endp': () => !$s('.stone').length,
        'make_gem': (x, y) => {
            if (first && y + 3 < x) {
                return make_stone(x, y - size, rand_choice(current_stone_choices));
            } else {
                return make_number_gem(x, y - size);
            }
        }
    },
    'do_recipe': {
        'end': end_recipe,
        'endp': () => post_input.contains(current_recipe.input),
        'make_gem': (x, y) => {
            if (y < 2 && rand(10) === 0 && pre_input.size()) {
                let gem = make_item_gem(x, y - size, pre_input.pop_rand());
                show_inventer();
                return gem;
            } else {
                return make_number_gem(x, y - size);
            }
        }
    }
};

discoverables = [
    {
        'name': 'Recover layer hopper',
        'p': () => !inventar.get('broken_layer_hopper'),
        'items': () => Bag.from({'broken_layer_hopper': 1}),
        'foo': 8,
        'bar': 5
    }, {
        'name': 'Scavenge for spare parts',
        'p': () => true,
        'items': () => Bag.from({'spare_part': 2 + rand(10)}),
        'foo': 5,
        'bar': 5
    }
];
menu_entries = [
    {
        'name': 'Räume den Weg zur Tür frei',
        'p': () => path_is_free === false,
        'f': () => {
            current_stone_choices = ['Lampe', 'Monitor', 'Bettlacken', 'Stuhl', 'Kabel', 'Dreck', 'Medizin Fläschchen'];
            current_end = () => {
                path_is_free = true;
                current_end = undefined;
                message('Du öffnest die Tür')
                    .then(() => message('Du stehst in einem Krankenhausflur der genauso verwüstet ist wie dein Zimmer'))
                    .then(menu);
            }
            current_place = 'research';
            wait(1000).then(start);
        }
    },
    {
        'name': 'Den Flur durchsuchen',
        'p': () => path_is_free === true && discovered === false,
        'f': () => {
            current_stone_choices = ['Lampe', 'Bettlacken', 'Stuhl', 'Kabel', 'Dreck', 'Gardinenstange', 'Verdorte Pflanze'];
            current_end = () => {
                discovered = true;
                current_end = undefined;
                message('Der Flur ist komplett verlassen')
                    .then(() => message('Die anderen Zimmer ebenso verwüstet'))
                    .then(() => message('Am Ende des Flures ist eine Doppeltür mit einer fetten Stahlkette erschlossen'))
                    .then(() => message('In großen Buchstaben steht geschrieben:'))
                    .then(() => message('DONT DEAD OPEN INSIDE'))
                    .then(menu);
            }
            current_place = 'research';
            wait(1000).then(start);
        }
    },
    {
        'name': 'Die Doppeltür öffnen',
        'p': () => discovered === true,
        'f': () => {
            current_stone_choices = ['Kettenglied'];
            current_end = () => {
                current_end = undefined;
                    message('Als du Kette zerbriechts bersten die Türen auf')
                    .then(() => message('Ein Horde von Zombiedemonen strecken ihre Hände aus und ziehen dich in ihre Mitte'))
                    .then(() => message('Du wirst aufgegessen'))
                    .then(() => message('Game Over'))
                    .then(() => message('Sorry das Spiel kann man zurzeit noch nicht gewinnen'))
            }
            current_place = 'research';
            wait(1000).then(start);
        }
    }
];

let recipes = [
    {'input': Bag.from({'broken_layer_hopper': 1, 'spare_part': 10}),
     'output': Bag.from({'layer_hopper': 1}),
     'p': () => studied_broken_layer_hopper}
];
