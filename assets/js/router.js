// router.js - YandexRouter for geocoding and routing
export class YandexRouter {
  static async geocode(q) {
    if (!window.ymaps) {
      throw new Error('Yandex Maps not loaded');
    }

    try {
      const res = await ymaps.geocode(q, { results: 1 });
      const obj = res.geoObjects.get(0);
      if (!obj) {
        throw new Error('Address not found');
      }

      const coords = obj.geometry.getCoordinates();
      return {
        type: 'wayPoint',
        point: [coords[1], coords[0]],
        request: q,
        suggest: { display: q }
      };
    } catch (e) {
      console.error('Geocode failed:', e);
      throw new Error('Failed to resolve address: ' + q);
    }
  }

  static async build(points, opts = {}) {
    if (!window.ymaps) {
      throw new Error('Yandex Maps not loaded');
    }

    const wayPoints = points.map(p => p.point);
    const routingMode = opts.mode === 'truck' ? 'truck' : 'auto';
    const params = {
      routingMode,
      results: opts.alternatives || 1,
      avoidTrafficJams: true,
      strictBounds: false
    };

    if (opts.mode === 'truck') {
      if (opts.weight) {
        params.vehicleWeight = opts.weight;
      }
      if (opts.dimensions) {
        if (opts.dimensions.height) params.vehicleHeight = opts.dimensions.height;
        if (opts.dimensions.width)  params.vehicleWidth  = opts.dimensions.width;
        if (opts.dimensions.length) params.vehicleLength = opts.dimensions.length;
      }
    }

    try {
      const multiRoute = new ymaps.multiRouter.MultiRoute(
        { referencePoints: wayPoints },
        params
      );

      await new Promise((resolve, reject) => {
        multiRoute.model.events.once('requestsuccess', resolve);
        multiRoute.model.events.once('requestfail', () => {
          reject(new Error('Route request failed'));
        });
      });

      return {
        multiRoute,
        routes: multiRoute.model.getRoutes()
      };
    } catch (e) {
      console.error('Route build error:', e);
      throw new Error('Failed to build route: ' + (e.message || e));
    }
  }
}
