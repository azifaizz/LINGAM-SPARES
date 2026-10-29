package com.Billing.Software.billing_service.Config;

import com.github.benmanes.caffeine.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Collection;
import java.util.Collections;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.TimeUnit;

@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        return new CacheManager() {
            private final ConcurrentMap<String, org.springframework.cache.Cache> cacheMap = new ConcurrentHashMap<>();

            @Override
            public org.springframework.cache.Cache getCache(String name) {
                return cacheMap.computeIfAbsent(name, this::createCache);
            }

            @Override
            public Collection<String> getCacheNames() {
                return Collections.unmodifiableSet(cacheMap.keySet());
            }

            private org.springframework.cache.Cache createCache(String name) {
                if ("bills".equals(name)) {
                    Cache<Object, Object> caffeineCache = com.github.benmanes.caffeine.cache.Caffeine.newBuilder()
                            .maximumSize(200)
                            .expireAfterWrite(30, TimeUnit.SECONDS)
                            .build();
                    return new CaffeineCache(name, caffeineCache);
                }
                Cache<Object, Object> caffeineCache = com.github.benmanes.caffeine.cache.Caffeine.newBuilder()
                        .maximumSize(500)
                        .expireAfterWrite(2, TimeUnit.MINUTES)
                        .build();
                return new CaffeineCache(name, caffeineCache);
            }
        };
    }
}