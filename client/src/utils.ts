export class SeededRandom {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    setSeed(seed: number) {
        this.seed = seed;
    }

    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        const positiveSeed = (this.seed + 233280) % 233280;
        return positiveSeed / 233280;
    }

    nextInt(min: number, max: number) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
}

export class Noise {
    private p: number[] = [];
    constructor(seed: number) {
        const rand = new SeededRandom(seed);
        const p = Array.from({ length: 256 }, () => Math.floor(rand.next() * 256));
        this.p = p.concat(p);
    }
    private fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
    private lerp(t: number, a: number, b: number) { return a + t * (b - a); }
    private grad(hash: number, x: number, y: number) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : 0);
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    get(x: number, y: number) {
        const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
        x -= Math.floor(x); y -= Math.floor(y);
        const u = this.fade(x), v = this.fade(y);
        const p = this.p;
        const A = p[X] + Y, B = p[X + 1] + Y;
        return this.lerp(v,
            this.lerp(u, this.grad(p[A], x, y), this.grad(p[B], x - 1, y)),
            this.lerp(u, this.grad(p[A + 1], x, y - 1), this.grad(p[B + 1], x - 1, y - 1))
        );
    }
}
