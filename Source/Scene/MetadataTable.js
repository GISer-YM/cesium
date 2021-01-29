import Check from "../Core/Check.js";
import clone from "../Core/clone.js";
import ComponentDatatype from "../Core/ComponentDatatype.js";
import defaultValue from "../Core/defaultValue.js";
import defined from "../Core/defined.js";
import RuntimeError from "../Core/RuntimeError.js";
import MetadataComponentType from "./MetadataComponentType.js";
import MetadataEntity from "./MetadataEntity.js";
import MetadataOffsetType from "./MetadataOffsetType.js";
import MetadataType from "./MetadataType.js";

function MetadataTableProperty(
  arrayOffsets,
  stringOffsets,
  values,
  classProperty
) {
  this.arrayOffsets = arrayOffsets;
  this.stringOffsets = stringOffsets;
  this.values = values;
  this.classProperty = classProperty;
}

/**
 * A table containing binary metadata about a collection of entities.
 *
 * @param {Object} options Object with the following properties:
 * @param {Object} options.count The number of entities in the table.
 * @param {Object} options.properties A dictionary containing properties.
 * @param {MetadataClass} options.class The class that properties conforms to.
 * @param {Object} options.bufferViews An object mapping bufferView IDs to Uint8Array objects
 *
 * @alias MetadataTable
 * @constructor
 *
 * @private
 */
function MetadataTable(options) {
  options = defaultValue(options, defaultValue.EMPTY_OBJECT);

  //>>includeStart('debug', pragmas.debug);
  Check.typeOf.string("options.count", options.count);
  Check.typeOf.string("options.properties", options.properties);
  Check.typeOf.string("options.class", options.class);
  Check.typeOf.string("options.bufferViews", options.bufferViews);
  //>>includeEnd('debug');

  var properties = {};
  if (defined(options.properties)) {
    for (var propertyId in options.properties) {
      if (options.properties.hasOwnProperty(propertyId)) {
        properties[propertyId] = initializeProperty(
          count,
          options.properties[propertyId],
          options.class.properties[propertyId],
          options.bufferViews
        );
      }
    }
  }

  this._count = options.count;
  this._class = options.class;
  this._properties = properties;
}

Object.defineProperties(MetadataTileset.prototype, {
  /**
   * The class that properties conforms to.
   *
   * @memberof MetadataTileset.prototype
   * @type {MetadataClass}
   * @readonly
   * @private
   */
  class: {
    get: function () {
      return this._class;
    },
  },

  /**
   * A dictionary containing properties.
   *
   * @memberof MetadataTileset.prototype
   * @type {Object}
   * @readonly
   * @private
   */
  properties: {
    get: function () {
      return this._properties;
    },
  },
});

/**
 * Returns whether this property exists.
 *
 * @param {Number} index The index of the entity.
 * @param {String} propertyId The case-sensitive ID of the property.
 * @returns {Boolean} Whether this property exists.
 */
MetadataTable.prototype.hasProperty = function (index, propertyId) {
  return MetadataEntity.hasProperty(this, propertyId);
};

/**
 * Returns an array of property IDs.
 *
 * @param {Number} index The index of the entity.
 * @param {String[]} [results] An array into which to store the results.
 * @returns {String[]} The property IDs.
 */
MetadataTable.prototype.getPropertyIds = function (index, results) {
  return MetadataEntity.getPropertyIds(this, results);
};

/**
 * Returns a copy of the value of the property with the given ID.
 *
 * @param {Number} index The index of the entity.
 * @param {String} propertyId The case-sensitive ID of the property.
 * @returns {*} The value of the property or <code>undefined</code> if the property does not exist.
 */
MetadataTable.prototype.getProperty = function (index, propertyId) {
  var property = this._properties[propertyId];

  if (defined(property)) {
    var classProperty = property.classProperty;

    return clone(this._properties[propertyId], true);
  }

  if (
    defined(this._class.properties[propertyId]) &&
    defined(this._class.properties[propertyId].default)
  ) {
    return clone(this._class.properties[propertyId].default, true);
  }

  return undefined;
};

/**
 * Sets the value of the property with the given ID.
 * <p>
 * If a property with the given ID doesn't exist, it is created.
 * </p>
 *
 * @param {Number} index The index of the entity.
 * @param {String} propertyId The case-sensitive ID of the property.
 * @param {*} value The value of the property that will be copied.
 */
MetadataTable.prototype.setProperty = function (index, propertyId, value) {
  // TODO: How to create new property? If type is number create FLOAT64 array?
  // TODO: What about this function for MetadataTileset? What if the type is an object? It can't get styled if that's the case.
};

/**
 * Returns a copy of the value of the property with the given semantic.
 *
 * @param {Number} index The index of the entity.
 * @param {String} semantic The case-sensitive semantic of the property.
 * @returns {*} The value of the property or <code>undefined</code> if the property does not exist.
 */
MetadataTable.prototype.getPropertyBySemantic = function (index, semantic) {};

/**
 * Sets the value of the property with the given semantic.
 *
 * @param {Number} index The index of the entity.
 * @param {String} semantic The case-sensitive semantic of the property.
 * @param {*} value The value of the property that will be copied.
 */
MetadataTable.prototype.setPropertyBySemantic = function (
  index,
  semantic,
  value
) {};

function initializeProperty(count, property, classProperty, bufferViews) {
  // TODO: use BigUint64Array on platforms where it's supported
  if (property.offsetType === MetadataOffsetType.UINT64) {
    throw new RuntimeError("offsetType of UINT64 is not supported");
  }
  if (classProperty.enumType === MetadataEnumType.UINT64) {
    throw new RuntimeError("enumType of UINT64 is not supported");
  }
  if (classProperty.componentType === MetadataComponentType.UINT64) {
    throw new RuntimeError("componentType of UINT64 is not supported");
  }
  if (classProperty.type === MetadataType.UINT64) {
    throw new RuntimeError("type of UINT64 is not supported");
  }

  var i;

  var isArray = classProperty.type === MetadataType.ARRAY;
  var isVariableSizeArray = isArray && !defined(classProperty.componentCount);
  var hasStrings =
    classProperty.type === MetadataType.STRING ||
    classProperty.componentType === MetadataComponentType.STRING;
  var hasBooleans =
    classProperty.type === MetadataType.BOOLEAN ||
    classProperty.componentType === MetadataComponentType.BOOLEAN;

  var offsetType = defaultValue(
    MetadataOffsetType[property.offsetType],
    MetadataOffsetType.UINT32
  );
  var offsetComponentDatatype = MetadataOffsetType.getComponentDatatype(
    offsetType
  );

  var arrayOffsets;
  if (isVariableSizeArray) {
    arrayOffsets = ComponentDatatype.createArrayBufferView(
      offsetComponentDatatype,
      bufferViews[property.arrayOffsetBufferView].buffer,
      bufferViews[property.arrayOffsetBufferView].byteOffset,
      count + 1
    );
  }

  var componentCount;
  if (isVariableSizeArray) {
    componentCount = 0;
    for (i = 0; i < count; ++i) {
      componentCount += arrayOffsets[i + 1] - arrayOffsets[i];
    }
  } else if (isArray) {
    componentCount = count * classProperty.componentCount;
  } else {
    componentCount = count;
  }

  var stringOffsets;
  if (hasStrings) {
    stringOffsets = ComponentDatatype.createArrayBufferView(
      offsetComponentDatatype,
      bufferViews[property.stringOffsetBufferView].buffer,
      bufferViews[property.stringOffsetBufferView].byteOffset,
      componentCount + 1
    );
  }

  var componentDatatype;
  if (hasStrings || hasBooleans) {
    // STRING and BOOLEAN types need to be parsed differently than other types
    componentDatatype = ComponentDatatype.UNSIGNED_BYTE;
  } else {
    componentDatatype = MetadataType.getComponentDatatype(
      classProperty.type,
      classProperty.componentType,
      classProperty.enumType
    );
  }

  var typedArrayCount;
  if (hasStrings) {
    typedArrayCount = 0;
    for (i = 0; i < componentCount; ++i) {
      typedArrayCount += stringOffsets[i + 1] - stringOffsets[i];
    }
  } else if (hasBooleans) {
    typedArrayCount = Math.ceil(componentCount / 8);
  } else {
    typedArrayCount = componentCount;
  }

  var values = ComponentDatatype.createArrayBufferView(
    componentDatatype,
    bufferViews[property.bufferView].buffer,
    bufferViews[property.bufferView].byteOffset,
    typedArrayCount
  );

  return new MetadataTableProperty(
    arrayOffsets,
    stringOffsets,
    values,
    classProperty
  );
}

export default MetadataTable;
