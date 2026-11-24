package com.healthmate.model;

/**
 * Represents a user's daily target goals for steps, calories, and water intake.
 */
public class DailyGoal {

    private int steps;
    private int calories;
    private int water;

    public DailyGoal() {
    }

    public DailyGoal(int steps, int calories, int water) {
        this.steps = steps;
        this.calories = calories;
        this.water = water;
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

