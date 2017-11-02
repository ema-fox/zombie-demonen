let $ = document.querySelector.bind(document);
let $s = document.querySelectorAll.bind(document);

Element.prototype.append = function (el) {
    this.insertBefore(el, null);
};
function element(tag, attrs, children) {
    let el = document.createElement(tag);
    for (let attr in attrs) {
        el.setAttribute(attr, attrs[attr]);
    }
    for (let child of children) {
        el.append(child);
    }
    return el;
}

let create_text = document.createTextNode.bind(document);

function make_button(text, cb, disabled, i) {
    let answer = element('div', {'class': 'answer' + (disabled ? ' disabled' : '')}, [
        element('span', {'class': 'answer-key'}, [create_text(i + 1)]),
        element('span', {'class': 'answer-text'}, [create_text(text)])
    ]);
    if (!disabled) {
        answer.on('click', cb);
    }
    return answer;
}

let current_choices;

function choice(msg, choices) {
    current_choices = [];
    let el = element('div', {'class': 'message'},
                     [create_text(msg)].concat(choices.map(([text, callback, disabled], i) => {
                         let cb = () => {
                             current_choices = undefined;
                             fade_out(el);
                             callback();
                         };
                         current_choices.push(cb);
                         return make_button(text, cb, disabled, i);
                     })));
    document.body.append(el);
    el.style.opacity = 0
    el.offsetHeight;
    el.style.opacity = 1;
}

addEventListener('keypress', event => {
    let num = event.key - 1;
    if (current_choices && typeof num === 'number' && num < current_choices.length) {
        current_choices[num]();
    }
});


function choice_p(msg, choices) {
    return new Promise(resolve => {
        choice(msg, choices.map(([text, value, disabled]) => {
            return [text, () => resolve(value), disabled];
        }));
    });
}

function message(msg) {
    return choice_p(msg, [['next', null]]);
}

