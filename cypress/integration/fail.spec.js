/// <reference types="cypress" />

describe("Example Tests", () => {
  it("test fail", () => {
    cy.visit("https://www.google.com");
    cy.wrap("hello").should("have.length", 1);
  });

  it("no network", () => {
    cy.wrap("hello").should("have.length", 1);
  });
});
