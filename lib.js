function* range(start, end) {
    if (end === undefined) {
        yield* range(0, start);
        return;
    }
    for (let i = start; i < end; i++) {
        yield i;
    }
}

function rand(a) {
    return Math.floor(Math.random() * a);
}

function rand_choice(xs) {
    return xs[rand(xs.length)];
}

class Bag extends Map {
    static from(obj) {
        return new Bag(Object.entries(obj));
    }
    set(key, value) {
        if (value === 0) {
            this.delete(key);
        } else {
            super.set(key, value);
        }
        return value;
    }
    get(key) {
        if (this.has(key)) {
            return super.get(key);
        } else {
            return 0;
        }
    }
    add(key, value) {
        this.set(key, this.get(key) + value);
    }
    incr(key) {
        this.add(key, 1);
    }
    decr(key) {
        this.add(key, -1);
    }
    remove(other) {
        for (let [key, value] of other) {
            this.add(key, -value);
        }
        return new Bag(other);
    }
    contains(other) {
        for (let [key, value] of other) {
            if (value > this.get(key)) {
                return false;
            }
        }
        return true;
    }
    size() {
        let size = 0;
        for (let [_, value] of this) {
            size += value;
        }
        return size;
    }
    pop_rand() {
        let x = rand(this.size());
        for (let [key, value] of this) {
            if (x < value) {
                this.decr(key);
                return key;
            } else {
                x -= value;
            }
        }
    }
}

