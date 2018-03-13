import React, { Component } from "react";
import { Image, Platform } from "react-native";
import RNFetchBlob from "react-native-fetch-blob";

import { ImageCache } from './Cache'

const SHA1 = require("crypto-js/sha1");
const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
const FILE_PREFIX = Platform.OS === "ios" ? "" : "file://";

export class BaseCachedImage extends Component {
    constructor() {
        super();
        this.handler = (path) => {
            this.setState({ path, loading: false });
        };
        this.state = { path: undefined, loading: true };
    }
    dispose() {
      return new Promise((resolve, reject)=> {
        if (this.dbPath) {
          ImageCache
          .get()
          .then((cacheInstance) => {
            cacheInstance.dispose(this.dbPath, this.handler);
            resolve();
          })
          .catch((err) => {
            console.log('Error observing- ', err)
            reject(err);
          })
        } else {
          resolve();
        }
      })
    }
    observe(source, mutable) {
        if (source.dbPath !== this.dbPath) {
            this.dispose().then(() => {
              this.dbPath = source.dbPath;

              ImageCache
              .get()
              .then((cacheInstance) => {
                cacheInstance.on(source, this.handler, !mutable);
              })
              .catch((err) => console.log('Error observing- ', err))
            });
        }
    }
    getProps() {
        const props = {};
        Object.keys(this.props).forEach(prop => {
            if (prop === "source" && this.props.source.dbPath) {
                props["source"] = this.state.path ? { dbPath: this.props.source.dbPath, dbProvider: this.props.source.dbProvider, uri: FILE_PREFIX + this.state.path } : {};
            }
            else if (["mutable", "component"].indexOf(prop) === -1) {
                props[prop] = this.props[prop];
            }
        });
        return props;
    }
    checkSource(source) {
        if (Array.isArray(source)) {
            throw new Error(`Giving multiple URIs to CachedImage is not yet supported.
            If you want to see this feature supported, please file and issue at
             https://github.com/wcandillon/react-native-img-cache`);
        }
        return source;
    }
    componentWillMount() {
        const { mutable } = this.props;
        const source = this.checkSource(this.props.source);
        if (source.dbPath) {
            this.observe(source, mutable === true);
        }
    }
    componentWillReceiveProps(nextProps) {
        const { mutable } = nextProps;
        const source = this.checkSource(nextProps.source);
        if (source.dbPath) {
            this.observe(source, mutable === true);
        }
    }
    componentWillUnmount() {
        this.dispose();
    }
}
export class CachedImage extends BaseCachedImage {
    constructor() {
        super();
    }
    render() {
        const props = this.getProps();
        const el = React.createElement(Image, Object.assign({}, props), this.props.children);
        return (
          <View style={{ flex: 1 }}>
            { el }
            {
              this.state.loading
              &&
              <ActivityIndicator
                style={{ position: 'absolute', bottom: 8, right: 8 }}
                animating={true}
                color={'#527da3'}
                size='small'/>
            }
          </View>
        )
    }
}
export class CustomCachedImage extends BaseCachedImage {
    constructor() {
        super();
    }
    render() {
        const { component } = this.props;
        const props = this.getProps();
        const Component = component;
        const el = React.createElement(Component, Object.assign({}, props), this.props.children);
        return (
          <View style={{ flex: 1 }}>
            { el }
            {
              this.state.loading
              &&
              <ActivityIndicator
                style={{ position: 'absolute', bottom: 8, right: 8 }}
                animating={true}
                color={'#527da3'}
                size='small'/>
            }
          </View>
        )
    }
}
