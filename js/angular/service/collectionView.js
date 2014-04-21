
IonicModule
.factory('$collectionView', [
  '$rootScope',
  '$timeout',
function($rootScope, $timeout) {
  var BUFFER_SPACES = 2;
  function CollectionView(options) {
    this.dataSource = options.dataSource;
    this.element = options.element;
    this.scrollView = options.scrollView;
    this.itemSizePrimary = options.itemSizePrimary;
    this.itemSizeSecondary = options.itemSizeSecondary;

    if (this.scrollView.options.scrollingX && this.scrollView.options.scrollingY) {
      throw new Error("TODO MOVE THIS ERROR TO THE DIRECTIVE. Cannot create a scrollCollectionView on an element that scrolls both x and y. Choose one, yo!");
    }

    this.isVertical = !!this.scrollView.options.scrollingY;
    this.renderedItems = [];

    this.lastRenderScrollValue = this.bufferTransformOffset = this.bufferStartIndex =
      this.bufferEndIndex = this.bufferItemsLength = 0;

    this.scrollView.__$callback = this.scrollView.__callback;
    this.scrollView.__callback = angular.bind(this, this.renderScroll);

    if (this.isVertical) {
      this.scrollView.options.getContentHeight = angular.bind(this, this.getContentSize);
      this.getScrollValue = function() {
        return this.scrollView.__scrollTop;
      };
      this.getScrollMaxValue = function() {
        return this.scrollView.__maxScrollTop;
      };
      this.getScrollSize = function() {
        return this.scrollView.__clientHeight;
      };
      this.getScrollSizeSecondary = function() {
        return this.scrollView.__clientWidth;
      };
    } else {
      this.scrollView.options.getContentWidth = angular.bind(this, this.getContentSize);
      this.getScrollValue = function() {
        return this.scrollView.__scrollLeft;
      };
      this.getScrollMaxValue = function() {
        return this.scrollView.__maxScrollLeft;
      };
      this.getScrollSize = function() {
        return this.scrollView.__clientWidth;
      };
      this.getScrollSizeSecondary = function() {
        return this.scrollView.__clientHeihgt;
      };
    }
    this.scrollView.resize();
  }

  CollectionView.prototype = {
    getContentSize: function() {
      return this.itemSizePrimary * this.dataSource.getLength() / this.getItemsPerSpace();
    },
    getItemsPerSpace: function() {
      return this.itemSizeSecondary ? 
        Math.floor(this.getScrollSizeSecondary() / this.itemSizeSecondary) :
        1;
    },
    renderScroll: ionic.animationFrameThrottle(function(transformLeft, transformTop, zoom, wasResize) {
      if (this.isVertical) {
        transformTop = this.getTransformPosition(transformTop);
      } else {
        transformLeft = this.getTransformPosition(transformLeft);
      }
      return this.scrollView.__$callback(transformLeft, transformTop, zoom, wasResize);
    }),
    getTransformPosition: function(transformPos) {
      var difference = transformPos - this.lastRenderScrollValue;
      if (Math.abs(difference - this.bufferTransformOffset) >= this.itemSizePrimary) {
        var scrollValue = this.getScrollValue();
        if (scrollValue >= 0 && scrollValue <= this.getScrollMaxValue()) {
          this.render();
          return transformPos - this.lastRenderScrollValue;
        }
      }
      return difference;
    },
    render: function(shouldRedrawAll) {
      var i;
      var itemsPerSpace = this.getItemsPerSpace();
      var viewportSpaces = Math.floor(this.getScrollSize() / this.itemSizePrimary);
      var viewportStartIndex = Math.ceil(this.getScrollValue() / this.itemSizePrimary) *
        itemsPerSpace;
      var viewportEndIndex = viewportStartIndex + (viewportSpaces * itemsPerSpace);

      var bufferSize = BUFFER_SPACES * itemsPerSpace;
      var bufferStartIndex = Math.max(0, viewportStartIndex - bufferSize);
      var bufferEndIndex = Math.min(this.dataSource.getLength(), viewportEndIndex + bufferSize);
      var bufferItemsLength = bufferEndIndex - bufferStartIndex;

      if (shouldRedrawAll) {
        for (i in this.renderedItems) {
          this.removeItem(i);
        }
        for (i = bufferStartIndex; i <= bufferEndIndex; i++) {
          this.renderItem(i);
        }
      } else {
        //If the change in index is bigger than our list size, rerender everything
        if (bufferEndIndex - this.bufferEndIndex > this.bufferItemsLength) {
          for (i = bufferStartIndex; i <= bufferEndIndex; i++) {
            this.renderItem(i);
          }
      console.log(this.bufferTransformOffset);
        //Append new items if scrolling down
        } else if (bufferEndIndex > this.bufferEndIndex) {
          for (i = this.bufferEndIndex + 1; i <= bufferEndIndex; i++) {
            this.renderItem(i);
          }
        //Prepend new items if scrolling up
        } else if (bufferStartIndex < this.bufferStartIndex) {
          for (i = this.bufferStartIndex - 1; i >= bufferStartIndex; i--) {
            this.renderItem(i, true);
          }
        }
        //Detach items that aren't in the new range
        for (i in this.renderedItems) {
          if (i < bufferStartIndex || i > bufferEndIndex) {
            this.removeItem(i);
          }
        }
      }

      //Save values
      this.bufferStartIndex = bufferStartIndex;
      this.bufferEndIndex = bufferEndIndex;
      this.bufferItemsLength = bufferItemsLength;

      var bufferLength = viewportStartIndex - this.bufferStartIndex;
      this.bufferTransformOffset = Math.ceil(bufferLength / itemsPerSpace) *
        this.itemSizePrimary;
      this.lastRenderScrollValue = Math.ceil(this.bufferStartIndex / itemsPerSpace) *
        this.itemSizePrimary;

      console.log('render(). viewportStartIndex =', viewportStartIndex, 
                  'bufferTransformOffset =', this.bufferTransformOffset,
                  'scrollValue ', this.lastRenderScrollValue);

      if (!this.dataSource.scope.$$phase) {
        this.dataSource.scope.$digest();
      }
    },
    renderItem: function(dataIndex, shouldPrepend) {
      var item = this.dataSource.getItemAt(dataIndex);
      if (item) {
        this.dataSource.attachItem(item, shouldPrepend);
        this.renderedItems[dataIndex] = item;
      }
    },
    removeItem: function(dataIndex) {
      var item = this.renderedItems[dataIndex];
      if (item) {
        this.dataSource.detachItem(item);
        delete this.renderedItems[dataIndex];
      }
    }
  };

  return CollectionView;
}])

.factory('$collectionViewDataSource', [
  '$cacheFactory',
  '$parse',
function($cacheFactory, $parse) {
  var nextCacheId = 0;
  function CollectionViewDataSource(options) {
    var self = this;
    this.scope = options.scope;
    this.transcludeFn = options.transcludeFn;
    this.transcludeParent = options.transcludeParent;

    this.keyExpr = options.keyExpr;
    this.listExpr = options.listExpr;
    this.trackByExpr = options.trackByExpr;

    if (this.trackByExpr) {
      var trackByGetter = $parse(this.trackByExpr);
      var hashFnLocals = {$id: hashKey};
      this.trackByIdGetter = function(index, value) {
        hashFnLocals[self.keyExpr] = value;
        hashFnLocals.$index = index;
        return trackByGetter(self.scope, hashFnLocals);
      };
    } else {
      this.trackByIdGetter = function(index, value) {
        return hashKey(value);
      };
    }

    var cache = $cacheFactory(nextCacheId++/*, {size: 500}*/);
    this.itemCache = {
      put: function(index, value, item) {
        return cache.put(self.trackByIdGetter(index, value), item);
      },
      get: function(index, value) {
        return cache.get(self.trackByIdGetter(index, value));
      }
    };

  }
  CollectionViewDataSource.prototype = {
    compileItem: function(index, value) {
      var cachedItem = this.itemCache.get(index, value);
      if (cachedItem) return cachedItem;

      var childScope = this.scope.$new();
      var element;

      childScope[this.keyExpr] = value;

      this.transcludeFn(childScope, function(clone) {
        element = clone;
      });

      return this.itemCache.put(index, value, {
        element: element,
        scope: childScope
      });
    },
    getItemAt: function(index) {
      if (index >= this.getLength()) return;

      var value = this.data[index];
      var item = this.compileItem(index, value);

      if (item.scope.$index !== index) {
        item.scope.$index = item.index = index;
        item.scope.$first = (index === 0);
        item.scope.$last = (index === (this.getLength() - 1));
        item.scope.$middle = !(item.scope.$first || item.scope.$last);
        item.scope.$odd = !(item.scope.$even = (index&1) === 0);
      }

      return item;
    },
    detachItem: function(item) {
      //Don't .remove(), that will destroy element data
      for (var i = 0; i < item.element.length; i++) {
        var node = item.element[i];
        var parent = node.parentNode;
        parent && parent.removeChild(node);
      }
      //Don't .$destroy(), just stop watchers and events firing
      disconnectScope(item.scope);
    },
    attachItem: function(item, shouldPrepend) {
      if (shouldPrepend) {
        this.transcludeParent[0].insertBefore(item.element[0], this.transcludeParent[0].firstElementChild);
      } else {
        this.transcludeParent[0].appendChild(item.element[0]);
      }
      reconnectScope(item.scope);
    },
    getData: function() {
      return this.data || [];
    },
    getLength: function() {
      return this.data && this.data.length || 0;
    },
    setData: function(value) {
      this.data = value;
    },
  };

  return CollectionViewDataSource;
}])

.directive('scrollItemRepeat', [
  '$collectionView',
  '$collectionViewDataSource',
function($collectionView, $collectionViewDataSource) {
  function itemScrollSizeError(value) {
    return new Error("scroll-item-repeat expected attribute item-scroll-size to be a number but got '" + value + "'.");
  }
  return {
    priority: 1000,
    transclude: 'element',
    terminal: true,
    $$tlb: true,
    require: '^$ionicScroll',
    link: function($scope, $element, $attr, scrollCtrl, $transclude) {
      var size = $attr.scrollItemSize;
      if (!size) {
        throw itemScrollSizeError(size);
      }

      size = size.replace(/px/g,'').replace(/\s/g,'').split(',');
      var primarySize = parseInt(size[0], 10);
      var secondarySize = parseInt(size[1], 10);
      if (!primarySize) {
        throw itemScrollSizeError(size);
      }

      var match = $attr.scrollItemRepeat.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)(?:\s+track\s+by\s+([\s\S]+?))?\s*$/);
      if (!match) {
        throw new Error("scroll-item-repeat expected expression in form of '_item_ in _collection_[ track by _id_]' but got '" + $attr.scrollItemRepeat + "'.");
      }

      var dataSource = new $collectionViewDataSource({
        scope: $scope,
        transcludeFn: $transclude,
        transcludeParent: $element.parent(),
        keyExpr: match[1],
        listExpr: match[2],
        trackByExpr: match[3]
      });
      var collectionView = new $collectionView({
        dataSource: dataSource,
        element: scrollCtrl.$element,
        scrollView: scrollCtrl.scrollView,
        itemSizePrimary: primarySize,
        itemSizeSecondary: secondarySize
      });

      $scope.$watchCollection(dataSource.listExpr, function(value) {
        dataSource.setData(value);
        scrollCtrl.scrollView.resize();
        collectionView.render(true);
      });

      $scope.$on('$destroy'); //TODO
    }
  };
}]);

/**
 * Computes a hash of an 'obj'.
 * Hash of a:
 *  string is string
 *  number is number as string
 *  object is either result of calling $$hashKey function on the object or uniquely generated id,
 *         that is also assigned to the $$hashKey property of the object.
 *
 * @param obj
 * @returns {string} hash string such that the same input will have the same hash string.
 *         The resulting string key is in 'type:hashKey' format.
 */
function hashKey(obj) {
  var objType = typeof obj,
      key;

  if (objType == 'object' && obj !== null) {
    if (typeof (key = obj.$$hashKey) == 'function') {
      // must invoke on object to keep the right this
      key = obj.$$hashKey();
    } else if (key === undefined) {
      key = obj.$$hashKey = ionic.Utils.nextUid();
    }
  } else {
    key = obj;
  }

  return objType + ':' + key;
}

function disconnectScope(scope) {
  if (scope.$root === scope) {
    return; // we can't disconnect the root node;
  }
  var parent = scope.$parent;
  scope.$$disconnected = true;
  // See Scope.$destroy
  if (parent.$$childHead === scope) {
    parent.$$childHead = scope.$$nextSibling;
  }
  if (parent.$$childTail === scope) {
    parent.$$childTail = scope.$$prevSibling;
  }
  if (scope.$$prevSibling) {
    scope.$$prevSibling.$$nextSibling = scope.$$nextSibling;
  }
  if (scope.$$nextSibling) {
    scope.$$nextSibling.$$prevSibling = scope.$$prevSibling;
  }
  scope.$$nextSibling = scope.$$prevSibling = null;
}

function reconnectScope(scope) {
  if (scope.$root === scope) {
    return; // we can't disconnect the root node;
  }
  if (!scope.$$disconnected) {
    return;
  }
  var parent = scope.$parent;
  scope.$$disconnected = false;
  // See Scope.$new for this logic...
  scope.$$prevSibling = parent.$$childTail;
  if (parent.$$childHead) {
    parent.$$childTail.$$nextSibling = scope;
    parent.$$childTail = scope;
  } else {
    parent.$$childHead = parent.$$childTail = scope;
  }
}
