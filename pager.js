/* diagram of paging window
<newer                                                                   older> 
|...............|...............|...............|...............|.............. 
n               o                                                               
                n               o                                               
                                n               o                               
                                                n               o               
*/
var chalk = require("chalk")
var debug = require("./debug")
// TODO: release as module
function Pager (opts) {
    if (!(this instanceof Pager)) return new Pager(opts)
    opts = opts || {}
    this.startpoint = opts.startpoint || null 
    this.endpoint = opts.endpoint || null 
    this.pagesize = opts.pagesize || Infinity
    this.stack = []
    this.cache = []
    this._dir = ""
    this.paging = false
    this.pageIsPartial = false
    this._hitTopBoundary = false
}

Pager.prototype.pageup = function (index) {
    this._dir = "up"
    console.error(chalk.green("pageup"))
    //debug.print("cache", this.cache)
    //debug.print("stack", this.stack)
    //console.error("hit top", this._hitTopBoundary)
    //console.error("page partial", this.pageIsPartial)
    // we haven't hit the last entry, push the window up the stack
    if (!this._hitTopBoundary && !this.pageIsPartial) this.stack.push(index)
    this.paging = this.stack.length > 0
    //console.error("pu paging", this.paging)
    //console.error(this.pageIsPartial)
    if (this.pageIsPartial) return { start: this._val(this.startpoint), end: this._val(this.endpoint) }
    return { start: index, end: null }
}

Pager.prototype.pagedown = function () {
    console.error(chalk.red("pagedown"))
    this._hitTopBoundary = false
    //debug.print("stack pd before", this.stack, true)
    this._dir = "down"
    var repush = this.stack.length > 1
    var p1 = this.stack.pop() || this._val(this.startpoint)
    var p2 = this.stack.pop() || this._val(this.endpoint)
    if (repush && !this.pageIsPartial) this.stack.push(p2)
    //debug.print("stack pd after", this.stack, true)
    this.paging = this.stack.length > 0
    return { start: p1, end: p2 }
}

Pager.prototype._val = function (v) {
    if (typeof v === 'function') return v()
    return v
}

Pager.prototype.clear = function () {
    this.stack = []
    this.cache = []
    this._dir = ""
    this.paging = false
    this.pageIsPartial = false
    this._hitTopBoundary = false
}

Pager.prototype.page = function (arr) {
    if (this.pagesize === Infinity) return arr
    let page
    let fullpageSize = this._val(this.pagesize)


    // the database only contains a partial page; don't cache, don't increase stack, don't pageup/down
    this.pageIsPartial = this.cache.length === 0 && this.stack.length === 0 && arr.length < fullpageSize
    //console.error("fullpage size", fullpageSize)
    //console.error("pageIsPartial", this.pageIsPartial)
    if (this.pageIsPartial) return arr 

    // we've gotten back a full size page, cache and return it
    if (arr.length === fullpageSize) {
        this.cache = arr.slice() // make a copy
        return arr
    // we've reached the end of history, return the cache
    } else if (arr.length === 0) {
        return this.cache.slice()
    }

    // we've hit a boundary of the database
    if (arr.length < fullpageSize) {
        if (this.stack.length > 0) {
            // we've been paging up and reached the topmost boundary i.e. 
            // the last known historic value in the db.
            // place the newer values at the front and slice the page from the start
            if (this._dir === "up") {
                this._hitTopBoundary = true
                this.cache = arr.concat(this.cache).slice(0, fullpageSize)
            // take the `arr.length` first values, and fill the rest with values from the cache
            } else if (this._dir === "down") {
                this.cache = arr.concat(this.cache.slice(arr.length)).slice(0, fullpageSize)
            }
            page = this.cache.slice()
        // we've paged backed to recent times and exhausted all of the newest values
        } else if (this.stack.length === 0) {
            // place the newest values at the back and slice the page starting from the last value
            page = this.cache.concat(arr).slice(-fullpageSize)
        }
        return page.slice()
    }
    this._hitTopBoundary = false
}


module.exports = Pager
