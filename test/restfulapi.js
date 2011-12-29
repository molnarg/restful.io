describe('The Restful API', function(){
  it('creates a default Session before accepting HTTP requests');

  describe('when emit is called on it', function() {
    it('forwards the event to all living Sessions');
  });

  describe('in case of an incoming HTTP request', function() {
    describe('without "Restfulio-Session" HTTP header', function() {
      it('forwards the request to the default Session');
    });

    describe('with "Restfulio-Session" HTTP header', function() {
      describe('when the header\'s value doesn\'t belong to any of the live sessions', function() {
        it('creates a new Session with the given Session ID');
        it('forwards the request to the created Session');
        it('starts a Time To Live timer, and kills the Session if it expires');
      });

      describe('when the header\'s value belongs to a live sessions', function() {
        it('forwards the request to the referenced Session');
        it('restarts the TTL timer of the referenced Session');
      });
    });
  });
});
