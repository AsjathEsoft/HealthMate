package com.healthmate.model;

/**
 * Represents a daily health record containing steps, calories, and water intake.
 */
public class HealthRecord {

    private int id;
    private int userId;
    private String date;
    private int steps;
    private int calories;
    private int water;

    public HealthRecord() {
    }

    public HealthRecord(int id, int userId, String date, int steps, int calories, int water) {
        this.id = id;
        this.userId = userId;
        this.date = date;
        this.steps = steps;
        this.calories = calories;
        this.water = water;
    }

    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public int getUserId() {
        return userId;
    }

    public void setUserId(int userId) {
        this.userId = userId;
    }

    public String getDate() {
        return date;
    }

    public void setDate(String date) {
        this.date = date;
    }

    public int getSteps() {
        return steps;
    }

    public void setSteps(int steps) {
        this.steps = steps;
    }

    public int getCalories() {
        return calories;
    }

    public void setCalories(int calories) {
        this.calories = calories;
    }

    public int getWater() {
        return water;
    }

    public void setWater(int water) {
        this.water = water;
    }
}

