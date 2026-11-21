package com.healthmate.model;

/**
 * Represents a registered HealthMate user returned by the API.
 * Sensitive fields (password_hash and salt) are never included in this model.
 */
public class User {

    private int id;
    private String name;
    private String email;
    private String photoUri;
    private String createdAt;

    public User() {
    }

    public User(int id, String name, String email, String photoUri, String createdAt) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.photoUri = photoUri;
        this.createdAt = createdAt;
    }

    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhotoUri() {
        return photoUri;
    }

    public void setPhotoUri(String photoUri) {
        this.photoUri = photoUri;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}

