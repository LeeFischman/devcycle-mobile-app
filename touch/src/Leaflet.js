/**
 * Wraps a Leaflet Map in an Ext.Component.
 *
 * ## Example
 *
 *     Ext.Viewport.add({
 *         xtype: 'leaflet',
 *         useCurrentLocation: true
 *     });
 *
 */


Ext.define('Ext.Leaflet', {
    extend: 'Ext.Component',
    xtype : 'leaflet',
    id: 'mapview',
    requires: ['Ext.util.GeoLocation'],

    isMap: true,

    config: {
        /**
         * @event maprender
         * @param {Ext.Map} this
         * @param {L.Map} map The rendered map instance
         */

        /**
         * @event centerchange
         * @param {Ext.Map} this
         * @param {L.Map} map The rendered map instance
         * @param {L.LatLng} center The current LatLng center of the map
         */

        /**
         * @event zoomchange
         * @param {Ext.Map} this
         * @param {L.Map} map The rendered Leaflet map instance
         * @param {Number} zoomLevel The current zoom level of the map
         */

        /**
         * @cfg {String} baseCls
         * The base CSS class to apply to the Maps's element
         * @accessor
         */
        baseCls: Ext.baseCSSPrefix + 'lmap',

        /**
         * @cfg {Boolean/Ext.util.GeoLocation} useCurrentLocation
         * Pass in true to center the map based on the geolocation coordinates or pass a
         * {@link Ext.util.GeoLocation GeoLocation} config to have more control over your GeoLocation options
         * @accessor
         */
        useCurrentLocation: false,

        /**
         * @cfg {map} map
         * The wrapped map.
         * @accessor
         */
        map: null,

        /**
         * @cfg {Ext.util.GeoLocation} geo
         * @accessor
         */
        geo: null,

        /**
         * @cfg {Object} mapOptions
         * @accessor
         */
        mapOptions: {}
    },

    constructor: function() {
        this.callParent(arguments);
        this.options= {};
        this.element.setVisibilityMode(Ext.Element.OFFSETS);
    },

    initialize: function() {
        this.callParent();
        this.geo = this.geo || new Ext.util.GeoLocation({
            autoLoad : false
        });
        this.on({
            painted: 'renderMap',
            scope: this
        });
        this.element.on('touchstart', 'onTouchStart', this);
    },

    onTouchStart: function(e) {
        e.makeUnpreventable();
    },

    applyMapOptions: function(options) {
        return Ext.merge({}, this.options, options);
    },

    updateMapOptions: function(newOptions) {
        var map = this.getMap();

        if (map) {
            map.setOptions(newOptions);
        }
    },

    getMapOptions: function() {
        return Ext.merge({}, this.options);
    },

    updateUseCurrentLocation: function(useCurrentLocation) {
        this.setGeo(useCurrentLocation);
    },

    applyGeo: function(config) {
        return Ext.factory(config, Ext.util.GeoLocation, this.getGeo());
    },

    updateGeo: function(newGeo, oldGeo) {
        var events = {
            locationupdate : 'onGeoUpdate',
            locationerror : 'onGeoError',
            scope : this
        };

        if (oldGeo) {
            oldGeo.un(events);
        }

        if (newGeo) {
            newGeo.on(events);
            newGeo.updateLocation();
        }
    },

    doResize: function() {
        var map = this.getMap();
        if (map) {
            map.invalidateSize();
        }
    },

    // @private
    renderMap: function() {
        var me = this,
            element = me.element,
            mapOptions = me.getMapOptions(),
            event;

        var mapInfo = Ext.getStore("MapInfo").getAt(0).data;
        console.log("Map info.. ");
        console.log(mapInfo);

        // Get map center info
        var centerInfo = mapInfo.center.split(",");
        var centerLat = centerInfo[1];
        var centerLong = centerInfo[0];

        // get map bounds
        var boundInfo = mapInfo.bounds.split(",");
        var southWest = L.latLng(boundInfo[1], boundInfo[0]);
        var northEast = L.latLng(boundInfo[3], boundInfo[2]);

        /*
            var cloudmadeUrl = 'http://{s}.tile.cloudmade.com/BC9A493B41014CAABB98F0471D759707/997/256/{z}/{x}/{y}.png',
      cloudmadeAttribution = 'Map data &copy; 2011 OpenStreetMap contributors, Imagery &copy; 2011 CloudMade',
      cloudmade = L.tileLayer(cloudmadeUrl, {maxZoom: 18, attribution: cloudmadeAttribution}),
      latlng = L.latLng(50.5, 30.51);

    var map = L.map('map', {center: latlng, zoom: 15, layers: [cloudmade]});
    */

        this.tileLayer = new L.TileLayer('resources/map_tiles/{z}/{x}/{y}.png', {
            attribution: mapInfo.attribution,
            maxZoom: mapInfo.maxzoom,
            minZoom: mapInfo.minzoom
        });

        mapOptions = Ext.merge({
            layers : [this.tileLayer],
            zoom : mapInfo.minzoom,
            zoomControl : true,
            attributionControl : true,
            center : new L.LatLng(centerLat, centerLong),
            maxBounds : L.latLngBounds(southWest, northEast)
        }, mapOptions);


        if (this.map === undefined){
          L.DomUtil.TRANSITION = hackRemember;
          this.map = new L.Map(element.id, mapOptions);

          // Remove the prepending leaflet link, as clicking will hijack the app!
          this.map.attributionControl.setPrefix("");
          this.map.addLayer(this.tileLayer);

          // load the data layer from the KML file downloaded from Mapbox.
          var data = new L.KML("resources/data.kml");

          self = this; // reference to self in handler

          // Wait until data layer has been loaded, then add it to the map
          var handler = setInterval(function(){
             loaded = data.isLoaded();
             if (loaded){
                  console.log("LOADED");

                  // cancel interval
                  clearInterval(handler);
                  handler = 0;

                  // we cluster for performance reasons and spidering for usability!
                  var markers = new L.MarkerClusterGroup({maxClusterRadius:50});
              
                  // iterate through all markers 
                  data.eachLayer(function (layer) {
                    markers.addLayer(layer);
                  });

                  self.map.addLayer(markers);
                  me.fireEvent('maprender', me, self.map);
             }
          }, 100);
        } else {
          me.fireEvent('maprender', me, self.map);
        }

    },

    // @private
    onGeoUpdate: function(geo) {
        if (geo) {
            this.setMapCenter(new L.LatLng(geo.getLatitude(), geo.getLongitude()));
        }
    },

    // @private
    onGeoError: Ext.emptyFn,

    /**
     * Moves the map center to the designated coordinates hash of the form:
     *
     *     { latitude: 39.290555, longitude: -76.609604 }
     *
     * or a L.LatLng object representing to the target location.
     *
     * @param {Object/L.LatLng} coordinates Object representing the desired Latitude and
     * longitude upon which to center the map.
     */
    setMapCenter: function(coordinates) {
        var me = this,
            map = me.getMap();

        if (map && coordinates) {
            if (!me.isPainted()) {
                me.un('painted', 'setMapCenter', this);
                me.on('painted', 'setMapCenter', this, { single: true, args: [coordinates] });
                return;
            }

            if (coordinates && !(coordinates instanceof L.LatLng) && 'longitude' in coordinates) {
                coordinates = new L.LatLng(coordinates.latitude, coordinates.longitude);
            }

            if (!map) {
                me.renderMap();
                map = me.getMap();
            }

            if (map && coordinates instanceof L.LatLng) {
                map.setView(ctr, this.zoomLevel);
            }
            else {
                this.options = Ext.apply(this.getMapOptions(), {
                    center: coordinates
                });
            }
        }
    },

    // @private
    onZoomChange : function() {
        var mapOptions = this.getMapOptions(),
            map = this.getMap(),
            zoom;

        zoom = (map && map.getZoom) ? map.getZoom() : mapOptions.zoom || 10;

        this.options = Ext.apply(mapOptions, {
            zoom: zoom
        });

        this.fireEvent('zoomchange', this, map, zoom);
    },

    // @private
    onCenterChange: function() {
        var mapOptions = this.getMapOptions(),
            map = this.getMap(),
            center;

        center = (map && map.getCenter) ? map.getCenter() : mapOptions.center;

        this.options = Ext.apply(mapOptions, {
            center: center
        });

        this.fireEvent('centerchange', this, map, center);

    },

    // @private
    destroy: function() {
        Ext.destroy(this.getGeo());
        this.callParent();
    }
});
